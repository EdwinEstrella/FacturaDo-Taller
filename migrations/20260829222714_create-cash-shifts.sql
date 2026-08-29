CREATE TABLE IF NOT EXISTS public."CashShift" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shiftNumber" serial,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  "openingBalance" numeric NOT NULL DEFAULT 0,
  "openedAt" timestamptz NOT NULL DEFAULT now(),
  "openedBy" text NOT NULL,
  "openedByName" text,
  "openingNotes" text,
  "closedAt" timestamptz,
  "closedBy" text,
  "closedByName" text,
  "totalBilled" numeric NOT NULL DEFAULT 0,
  "totalCollected" numeric NOT NULL DEFAULT 0,
  "cashCollected" numeric NOT NULL DEFAULT 0,
  "otherCollected" numeric NOT NULL DEFAULT 0,
  "totalExpenses" numeric NOT NULL DEFAULT 0,
  "expectedCash" numeric NOT NULL DEFAULT 0,
  "actualCash" numeric NOT NULL DEFAULT 0,
  "discrepancy" numeric NOT NULL DEFAULT 0,
  "billBreakdownRD" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "billBreakdownUSD" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "billBreakdownEUR" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "totalRD" numeric NOT NULL DEFAULT 0,
  "totalUSD" numeric NOT NULL DEFAULT 0,
  "totalEUR" numeric NOT NULL DEFAULT 0,
  "invoicesData" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "expensesData" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "paymentsData" jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cashshift_status_idx ON public."CashShift" (status);
CREATE INDEX IF NOT EXISTS cashshift_openedat_idx ON public."CashShift" ("openedAt" DESC);
CREATE INDEX IF NOT EXISTS cashshift_closedat_idx ON public."CashShift" ("closedAt" DESC);
CREATE INDEX IF NOT EXISTS cashshift_openedby_idx ON public."CashShift" ("openedBy");
