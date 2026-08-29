ALTER TABLE public."PettyCashClosing"
  ADD COLUMN IF NOT EXISTS "openedBy" text,
  ADD COLUMN IF NOT EXISTS "openedByName" text,
  ADD COLUMN IF NOT EXISTS "openedAt" timestamptz DEFAULT now();
