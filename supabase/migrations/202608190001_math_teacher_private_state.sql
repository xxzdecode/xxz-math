create table if not exists public.math_private_state_v1 (
  key text primary key check (key ~ '^math_[a-z0-9_]+$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.math_private_state_v1 enable row level security;
revoke all on public.math_private_state_v1 from public, anon, authenticated;
grant select, insert, update on public.math_private_state_v1 to service_role;

create table if not exists public.math_teacher_rate_limit_v1 (
  client_hash text primary key,
  window_started_at timestamptz not null default now(),
  failures integer not null default 0 check (failures >= 0),
  blocked_until timestamptz
);

alter table public.math_teacher_rate_limit_v1 enable row level security;
revoke all on public.math_teacher_rate_limit_v1 from public, anon, authenticated;
grant select, insert, update, delete on public.math_teacher_rate_limit_v1 to service_role;

create or replace function public.math_set_teaching_status_v1(
  p_student_id text,
  p_knowledge_id text,
  p_teaching_status text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_value jsonb;
  has_record boolean;
begin
  if p_student_id not in ('sister', 'brother') then raise exception 'invalid student'; end if;
  if p_knowledge_id !~ '^[a-z0-9][a-z0-9-]{1,99}$' then raise exception 'invalid knowledge id'; end if;
  if p_teaching_status not in ('not_recorded', 'learning', 'taught_by_us') then raise exception 'invalid teaching status'; end if;

  select value into current_value from public.math_private_state_v1 where key = 'math_student_progress_v1' for update;
  if current_value is null then raise exception 'math progress is not initialized'; end if;
  select exists(
    select 1 from jsonb_array_elements(current_value->'records') record
    where record->>'student_id' = p_student_id and record->>'knowledge_id' = p_knowledge_id
  ) into has_record;
  if not has_record then raise exception 'progress record not found'; end if;

  update public.math_private_state_v1
  set value = jsonb_set(
    current_value,
    '{records}',
    (
      select jsonb_agg(
        case when record->>'student_id' = p_student_id and record->>'knowledge_id' = p_knowledge_id
          then jsonb_set(record, '{teaching_status}', to_jsonb(p_teaching_status), true)
          else record end
      )
      from jsonb_array_elements(current_value->'records') record
    ),
    true
  ), updated_at = now()
  where key = 'math_student_progress_v1';

  return jsonb_build_object(
    'student_id', p_student_id,
    'knowledge_id', p_knowledge_id,
    'teaching_status', p_teaching_status
  );
end;
$$;

revoke all on function public.math_set_teaching_status_v1(text, text, text) from public, anon, authenticated;
grant execute on function public.math_set_teaching_status_v1(text, text, text) to service_role;

create or replace function public.math_teacher_rate_limit_v1(
  p_client_hash text,
  p_event text default 'check'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_value public.math_teacher_rate_limit_v1%rowtype;
  current_at timestamptz := now();
begin
  if p_client_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid client hash'; end if;
  if p_event not in ('check', 'failure', 'success') then raise exception 'invalid rate event'; end if;
  if p_event = 'success' then
    delete from public.math_teacher_rate_limit_v1 where client_hash = p_client_hash;
    return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
  end if;

  select * into row_value from public.math_teacher_rate_limit_v1 where client_hash = p_client_hash for update;
  if row_value.client_hash is not null and row_value.blocked_until > current_at then
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', greatest(1, ceil(extract(epoch from row_value.blocked_until - current_at))::integer)
    );
  end if;

  if p_event = 'failure' then
    insert into public.math_teacher_rate_limit_v1(client_hash, window_started_at, failures, blocked_until)
    values (p_client_hash, current_at, 1, null)
    on conflict (client_hash) do update set
      window_started_at = case when excluded.window_started_at - math_teacher_rate_limit_v1.window_started_at >= interval '15 minutes' then excluded.window_started_at else math_teacher_rate_limit_v1.window_started_at end,
      failures = case when excluded.window_started_at - math_teacher_rate_limit_v1.window_started_at >= interval '15 minutes' then 1 else math_teacher_rate_limit_v1.failures + 1 end,
      blocked_until = case when (case when excluded.window_started_at - math_teacher_rate_limit_v1.window_started_at >= interval '15 minutes' then 1 else math_teacher_rate_limit_v1.failures + 1 end) >= 5 then excluded.window_started_at + interval '15 minutes' else null end
    returning * into row_value;
    if row_value.blocked_until > current_at then
      return jsonb_build_object('allowed', false, 'retry_after_seconds', 900);
    end if;
  elsif row_value.client_hash is not null and current_at - row_value.window_started_at >= interval '15 minutes' then
    delete from public.math_teacher_rate_limit_v1 where client_hash = p_client_hash;
  end if;
  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

revoke all on function public.math_teacher_rate_limit_v1(text, text) from public, anon, authenticated;
grant execute on function public.math_teacher_rate_limit_v1(text, text) to service_role;
