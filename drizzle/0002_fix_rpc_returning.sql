CREATE OR REPLACE FUNCTION op_query(p_sql text, p_params jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb AS $$
DECLARE
  rendered text := op_bind_sql(p_sql, p_params);
  result_rows jsonb := '[]'::jsonb;
  affected integer := 0;
  first_keyword text := upper(split_part(trim(rendered), ' ', 1));
BEGIN
  IF first_keyword IN ('SELECT', 'WITH') THEN
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(to_jsonb(result_row)), ''[]''::jsonb) FROM (%s) result_row',
      rendered
    ) INTO result_rows;
    affected := jsonb_array_length(result_rows);
  ELSIF rendered ~* '\mRETURNING\M' THEN
    EXECUTE format(
      'WITH op_mutation AS (%s) SELECT COALESCE(jsonb_agg(to_jsonb(op_mutation)), ''[]''::jsonb) FROM op_mutation',
      rendered
    ) INTO result_rows;
    affected := jsonb_array_length(result_rows);
  ELSE
    EXECUTE rendered;
    GET DIAGNOSTICS affected = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('rows', result_rows, 'count', affected);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION op_query(text, jsonb) TO service_role;
