-- Preserve rollback compatibility with the prior application artifact while
-- accepting the provider-returned model identifier from the current writer.
-- Both accepted envelopes remain exact allowlists; no historical model name
-- is fabricated from the configured alias.

create or replace function private.is_valid_model_metadata(candidate jsonb)
returns boolean
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  usage_data jsonb;
  input_tokens numeric;
  cached_input_tokens numeric;
  cache_write_input_tokens numeric;
  output_tokens numeric;
  reasoning_output_tokens numeric;
  total_tokens numeric;
begin
  if not private.jsonb_object_matches(
      candidate,
      array['request_id', 'model_name', 'usage'],
      array['request_id', 'usage']
    )
    or not (
      candidate -> 'request_id' = 'null'::jsonb
      or (
        pg_catalog.jsonb_typeof(candidate -> 'request_id') = 'string'
        and pg_catalog.char_length(candidate ->> 'request_id') between 1 and 200
        and candidate ->> 'request_id' ~ '^[A-Za-z0-9_-]+$'
      )
    )
    or (
      candidate ? 'model_name'
      and (
        pg_catalog.jsonb_typeof(candidate -> 'model_name') <> 'string'
        or pg_catalog.char_length(candidate ->> 'model_name') not between 1 and 120
        or candidate ->> 'model_name' !~ '^[A-Za-z0-9._:/-]+$'
      )
    ) then
    return false;
  end if;

  usage_data := candidate -> 'usage';
  if usage_data = 'null'::jsonb then
    return true;
  end if;
  if not private.jsonb_object_matches(
      usage_data,
      array[
        'input_tokens',
        'cached_input_tokens',
        'cache_write_input_tokens',
        'output_tokens',
        'reasoning_output_tokens',
        'total_tokens'
      ],
      array[
        'input_tokens',
        'cached_input_tokens',
        'cache_write_input_tokens',
        'output_tokens',
        'reasoning_output_tokens',
        'total_tokens'
      ]
    )
    or exists (
      select 1
      from pg_catalog.jsonb_each(usage_data) as token_field(key, value)
      where pg_catalog.jsonb_typeof(token_field.value) <> 'number'
        or token_field.value #>> '{}' !~ '^\d+$'
    ) then
    return false;
  end if;

  input_tokens := (usage_data ->> 'input_tokens')::numeric;
  cached_input_tokens := (usage_data ->> 'cached_input_tokens')::numeric;
  cache_write_input_tokens := (
    usage_data ->> 'cache_write_input_tokens'
  )::numeric;
  output_tokens := (usage_data ->> 'output_tokens')::numeric;
  reasoning_output_tokens := (
    usage_data ->> 'reasoning_output_tokens'
  )::numeric;
  total_tokens := (usage_data ->> 'total_tokens')::numeric;
  return input_tokens between 0 and 1000000
    and cached_input_tokens between 0 and input_tokens
    and cache_write_input_tokens between 0 and input_tokens
    and output_tokens between 0 and 1000000
    and reasoning_output_tokens between 0 and output_tokens
    and total_tokens between 0 and 2000000
    and total_tokens = input_tokens + output_tokens;
exception when others then
  return false;
end;
$$;

revoke all on function private.is_valid_model_metadata(jsonb)
  from public, anon, authenticated, service_role;
