INSERT INTO public."Setting" (key, value)
VALUES ('NCF_B01', 'B0100000016')
ON CONFLICT (key) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS invoice_ncf_unique_idx
ON public."Invoice" (ncf)
WHERE ncf IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_ncf_for_taxed_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_ncf text;
  v_next_ncf text;
BEGIN
  IF NEW.ncf IS NOT NULL THEN
    NEW."hasNcf" := true;
    RETURN NEW;
  END IF;

  IF coalesce(nullif(NEW.tax, ''), '0')::numeric <= 0 THEN
    NEW."hasNcf" := false;
    RETURN NEW;
  END IF;

  SELECT value
  INTO v_ncf
  FROM public."Setting"
  WHERE key = 'NCF_B01'
  FOR UPDATE;

  IF v_ncf IS NULL OR v_ncf !~ '^B01[0-9]{8}$' THEN
    RAISE EXCEPTION 'La secuencia NCF B01 no esta configurada correctamente';
  END IF;

  v_next_ncf := 'B01' || lpad(((substring(v_ncf FROM 4))::bigint + 1)::text, 8, '0');

  NEW.ncf := v_ncf;
  NEW."hasNcf" := true;

  UPDATE public."Setting"
  SET value = v_next_ncf,
      "updatedAt" = now()
  WHERE key = 'NCF_B01';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoice_assign_ncf_for_taxed_invoice ON public."Invoice";

CREATE TRIGGER invoice_assign_ncf_for_taxed_invoice
BEFORE INSERT OR UPDATE ON public."Invoice"
FOR EACH ROW
EXECUTE FUNCTION public.assign_ncf_for_taxed_invoice();
