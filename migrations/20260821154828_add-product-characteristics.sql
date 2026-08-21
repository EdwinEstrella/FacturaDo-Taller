ALTER TABLE public."Product"
  ADD COLUMN IF NOT EXISTS characteristics jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public."Product"
  DROP CONSTRAINT IF EXISTS product_characteristics_array_check;

ALTER TABLE public."Product"
  ADD CONSTRAINT product_characteristics_array_check
  CHECK (jsonb_typeof(characteristics) = 'array');
