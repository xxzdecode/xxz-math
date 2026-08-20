insert into public.math_private_state_v1(key, value)
values ('math_student_progress_v1', '{"schema_version":2,"records":[]}'::jsonb)
on conflict (key) do nothing;

create or replace function public.math_set_display_status_v1(
  p_student_id text,
  p_knowledge_id text,
  p_display_status text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_value jsonb;
  current_records jsonb;
  updated_records jsonb;
  record_exists boolean;
  updated_at_value text := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if p_student_id not in ('sister', 'brother') then raise exception 'invalid student'; end if;
  if p_knowledge_id !~ '^[a-z0-9][a-z0-9-]{1,99}$' then raise exception 'invalid knowledge id'; end if;
  if p_display_status not in ('red', 'yellow', 'green') then raise exception 'invalid display status'; end if;

  select value into current_value from public.math_private_state_v1
  where key = 'math_student_progress_v1' for update;
  if current_value is null then
    current_value := '{"schema_version":2,"records":[]}'::jsonb;
    insert into public.math_private_state_v1(key, value)
    values ('math_student_progress_v1', current_value)
    on conflict (key) do update set value = excluded.value;
  end if;
  current_records := coalesce(current_value->'records', '[]'::jsonb);
  select exists(
    select 1 from jsonb_array_elements(current_records) record
    where record->>'student_id' = p_student_id and record->>'knowledge_id' = p_knowledge_id
  ) into record_exists;

  if record_exists then
    select jsonb_agg(
      case when record->>'student_id' = p_student_id and record->>'knowledge_id' = p_knowledge_id
        then jsonb_set(jsonb_set(jsonb_set(record, '{display_status}', to_jsonb(p_display_status), true), '{status_source}', '"manual"'::jsonb, true), '{status_updated_at}', to_jsonb(updated_at_value), true)
        else record end
    ) into updated_records
    from jsonb_array_elements(current_records) record;
  else
    updated_records := current_records || jsonb_build_array(jsonb_build_object(
      'student_id', p_student_id,
      'knowledge_id', p_knowledge_id,
      'handoff_status', 'not_reported',
      'teaching_status', 'not_recorded',
      'mastery_status', 'unverified',
      'display_status', p_display_status,
      'status_source', 'manual',
      'status_updated_at', updated_at_value
    ));
  end if;

  update public.math_private_state_v1
  set value = jsonb_set(jsonb_set(current_value, '{schema_version}', '2'::jsonb, true), '{records}', updated_records, true),
      updated_at = now()
  where key = 'math_student_progress_v1';

  return jsonb_build_object(
    'student_id', p_student_id,
    'knowledge_id', p_knowledge_id,
    'display_status', p_display_status,
    'status_source', 'manual',
    'status_updated_at', updated_at_value
  );
end;
$$;

revoke all on function public.math_set_display_status_v1(text, text, text) from public, anon, authenticated;
grant execute on function public.math_set_display_status_v1(text, text, text) to service_role;
