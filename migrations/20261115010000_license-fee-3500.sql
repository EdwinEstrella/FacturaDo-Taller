-- Migration: 20261115010000_license-fee-3500.sql
-- Monthly license fee changed to RD$3,500 (previously RD$5,000).
-- Due day (13th of each month) with 3-day grace until the 16th is computed by the license-cycle
-- edge function (dates are stored per cycle in "dueDate" and "graceUntil"). From the 17th the app locks.
-- This migration updates the default value for the "amount" column in "LicenseCycle".
-- Idempotent: re-running ALTER COLUMN ... SET DEFAULT is safe and harmless.

ALTER TABLE public."LicenseCycle" ALTER COLUMN amount SET DEFAULT 3500;
