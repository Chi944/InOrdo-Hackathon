-- Forward-repair the already-linked Prompt 7 functions. Fresh databases see
-- the corrected source in 20260718170000, so each replacement is conditional.

do $$
declare
  function_definition text;
  repaired_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'private.begin_project_analysis_internal(uuid,text,text,text,text,text,text,timestamptz,text,text)'::regprocedure
  )
  into function_definition;

  repaired_definition := pg_catalog.replace(
    pg_catalog.replace(
      function_definition,
      'pg_catalog.greatest(',
      'greatest('
    ),
    'pg_catalog.least(',
    'least('
  );
  if repaired_definition is distinct from function_definition then
    execute repaired_definition;
  end if;

  select pg_catalog.pg_get_functiondef(
    'private.complete_project_analysis_internal(uuid,text,jsonb)'::regprocedure
  )
  into function_definition;

  repaired_definition := pg_catalog.replace(
    pg_catalog.replace(
      pg_catalog.replace(
        function_definition,
        E'\n  hop_index integer;',
        ''
      ),
      E'\n  create_item_type public.project_item_type;',
      ''
    ),
    E'\n      create_item_type := (action_payload ->> ''item_type'')::public.project_item_type;',
    ''
  );
  if repaired_definition is distinct from function_definition then
    execute repaired_definition;
  end if;
end;
$$;

alter function private.is_iso_date_json(jsonb) stable;
