ALTER TABLE public."Invoice"
  ADD COLUMN IF NOT EXISTS discount numeric;

WITH invoice_subtotals AS (
  SELECT
    "invoiceId",
    coalesce(sum(
      (CASE WHEN nullif(price::text, '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN price::text::numeric ELSE 0 END)
      *
      (CASE WHEN nullif(quantity::text, '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN quantity::text::numeric ELSE 0 END)
    ), 0) AS subtotal
  FROM public."InvoiceItem"
  GROUP BY "invoiceId"
), invoice_discounts AS (
  SELECT
    invoice.id,
    greatest(
      coalesce(invoice_subtotals.subtotal, 0)
      + (CASE WHEN nullif(invoice.tax::text, '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN invoice.tax::text::numeric ELSE 0 END)
      + (CASE WHEN nullif(invoice."shippingCost"::text, '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN invoice."shippingCost"::text::numeric ELSE 0 END)
      - (CASE WHEN nullif(invoice.total::text, '') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN invoice.total::text::numeric ELSE 0 END),
      0
    ) AS discount
  FROM public."Invoice" invoice
  LEFT JOIN invoice_subtotals ON invoice_subtotals."invoiceId" = invoice.id
)
UPDATE public."Invoice" invoice
SET discount = invoice_discounts.discount
FROM invoice_discounts
WHERE invoice.id = invoice_discounts.id
  AND invoice.discount IS NULL;

UPDATE public."Invoice"
SET discount = 0
WHERE discount IS NULL;

ALTER TABLE public."Invoice"
  ALTER COLUMN discount SET DEFAULT 0,
  ALTER COLUMN discount SET NOT NULL;

ALTER TABLE public."Quote"
  ADD COLUMN IF NOT EXISTS discount numeric;

UPDATE public."Quote"
SET discount = 0
WHERE discount IS NULL;

ALTER TABLE public."Quote"
  ALTER COLUMN discount SET DEFAULT 0,
  ALTER COLUMN discount SET NOT NULL;
