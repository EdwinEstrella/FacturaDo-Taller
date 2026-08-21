ALTER TABLE public."InvoiceItem"
  ADD COLUMN IF NOT EXISTS characteristics jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public."QuoteItem"
  ADD COLUMN IF NOT EXISTS characteristics jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public."InvoiceItem"
  ADD CONSTRAINT invoiceitem_characteristics_array_check
  CHECK (jsonb_typeof(characteristics) = 'array');

ALTER TABLE public."QuoteItem"
  ADD CONSTRAINT quoteitem_characteristics_array_check
  CHECK (jsonb_typeof(characteristics) = 'array');
