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
