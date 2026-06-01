CREATE TABLE IF NOT EXISTS public."Payment" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoiceId" text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'CASH',
  reference text,
  notes text,
  date timestamptz NOT NULL DEFAULT now(),
  "createdAt" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_invoiceid_idx ON public."Payment" ("invoiceId");
CREATE INDEX IF NOT EXISTS payment_date_idx ON public."Payment" (date);

CREATE TABLE IF NOT EXISTS public."DailyClose" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "closeDate" timestamptz NOT NULL,
  "totalBilled" numeric NOT NULL DEFAULT 0,
  "totalCollected" numeric NOT NULL DEFAULT 0,
  "cashCollected" numeric NOT NULL DEFAULT 0,
  "otherCollected" numeric NOT NULL DEFAULT 0,
  "totalExpenses" numeric NOT NULL DEFAULT 0,
  "netCashInDrawer" numeric NOT NULL DEFAULT 0,
  "billBreakdownRD" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "billBreakdownUSD" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "billBreakdownEUR" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "totalRD" numeric NOT NULL DEFAULT 0,
  "totalUSD" numeric NOT NULL DEFAULT 0,
  "totalEUR" numeric NOT NULL DEFAULT 0,
  discrepancy numeric NOT NULL DEFAULT 0,
  "invoicesData" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "expensesData" jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  "closedBy" text NOT NULL,
  "closedByName" text,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dailyclose_closedby_closedate_idx ON public."DailyClose" ("closedBy", "closeDate");
CREATE INDEX IF NOT EXISTS dailyclose_closedate_idx ON public."DailyClose" ("closeDate");

CREATE TABLE IF NOT EXISTS public."ClientHistory" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clientId" text NOT NULL,
  action text NOT NULL,
  description text,
  metadata text,
  "createdAt" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clienthistory_clientid_createdat_idx ON public."ClientHistory" ("clientId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS public."PettyCashClosing" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "openingBalance" numeric NOT NULL DEFAULT 0,
  "totalIncome" numeric NOT NULL DEFAULT 0,
  "totalExpense" numeric NOT NULL DEFAULT 0,
  "closingBalance" numeric NOT NULL DEFAULT 0,
  notes text,
  "closedBy" text NOT NULL,
  "closedByName" text,
  "closedAt" timestamptz NOT NULL DEFAULT now(),
  "createdAt" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pettycashclosing_closedat_idx ON public."PettyCashClosing" ("closedAt" DESC);
CREATE INDEX IF NOT EXISTS pettycashclosing_closedby_idx ON public."PettyCashClosing" ("closedBy");

ALTER TABLE public."Transaction"
  ADD COLUMN IF NOT EXISTS "closingId" text;

CREATE INDEX IF NOT EXISTS transaction_closingid_idx ON public."Transaction" ("closingId");
CREATE INDEX IF NOT EXISTS transaction_category_closingid_idx ON public."Transaction" (category, "closingId");

CREATE OR REPLACE FUNCTION public.sync_product_stock_from_variants(p_product_id text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock integer;
BEGIN
  SELECT coalesce(sum(coalesce(stock, 0)), 0)::integer
  INTO v_stock
  FROM public."ProductVariant"
  WHERE "productId" = p_product_id;

  UPDATE public."Product"
  SET stock = v_stock,
      "updatedAt" = now()
  WHERE id = p_product_id::uuid;

  RETURN v_stock;
END;
$$;
