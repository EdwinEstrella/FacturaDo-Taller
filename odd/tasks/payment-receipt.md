# Payment Receipt Ticket + Correct Receivable Balance

## Objective
Provide an auto-printed 80mm thermal receipt ticket after registering an abono (payment) on an invoice, ensure invoice balance and status are consistently derived from actual payments and credit notes, and provide payment history with receipt reprinting for receivables.

## Problem / Why
1. `actions/invoice-actions.ts` (`updateInvoice`) updates invoice total upon editing items/costs but never recalculates `balance` or `status`. For example, Invoice #104 was created for RD$41,500 with a RD$20,750 payment, later edited to RD$57,500; the stored balance remained RD$20,750 instead of RD$36,750.
2. `actions/receivables-actions.ts` (`registerPayment`) computes `newBalance = Number(invoice.balance) - amount`, trusting the potentially stale stored balance and ignoring credit notes.
3. In `PaymentDialog`, `invoice.balance || invoice.total` has a JavaScript falsy bug where a balance of 0 falls back to the total.
4. When a payment or abono is registered, no physical receipt or ticket is generated for the customer, and there is no UI to view payment history or reprint receipts for previous payments.

## Scope
- Shared helper `lib/receivables/invoice-balance.ts` to derive invoice balance and payment status from actual `Payment` and `CreditNote` records (`balance = max(total - paid - credited, 0)`).
- Update `actions/invoice-actions.ts` (`updateInvoice`) to recompute balance and status using the shared helper within the same update.
- Update `actions/receivables-actions.ts` (`registerPayment`) to compute balance with the shared helper, validate payments against current balance, check `Payment` insert error, and return payment/receipt data.
- New server action `getPaymentReceipt(paymentId)` returning serialized invoice, payment, balance, and company settings.
- New component `components/modules/receivables/payment-receipt-template.tsx` (80mm ticket matching invoice template aesthetics).
- Update `PaymentDialog` to auto-print receipt upon registering an abono (silent via Electron if configured), fix `balance || total` bug, and display reprint / close options.
- New component `components/modules/receivables/payment-history-dialog.tsx` and updated `app/(dashboard)/receivables/page.tsx` to display real derived balance in "Monto Pendiente" and allow viewing payment history with reprint per payment.
- Check invoice detail pages: no dedicated invoice detail page with a payments section exists (invoices page uses list + preview modal), so integration is concentrated on receivables.

## Constraints
- Do NOT touch or stage `.env.local`.
- Do NOT run `git checkout`, `git restore`, `git stash`, `git reset`, `git clean`.
- Do NOT stage or commit `components/layout/top-nav.tsx` (leave pre-existing modification untouched; stage files explicitly by path).
- Do NOT mutate or run migrations on the production database.
- Conventional Commits without AI attribution or Co-Authored-By.
- Code, identifiers, and comments in English; UI copy in Spanish (neutral/professional).
- No native popups (`alert`, `confirm`, `window.print`). Use shadcn Dialog/toast and `useInvoicePrint`.
- TDD: OFF (no test runner in project). Checks: `npx tsc --noEmit` and `npx eslint`.

## Checks
- `npx tsc --noEmit`
- `npx eslint <changed files>`
- `git status --short`
- `git log --oneline -4`

## Tasks
- [x] T0 — Feature document `odd/tasks/payment-receipt.md` and Engram initialization (`odd/payment-receipt/tasks`)
- [x] T1 — Derive invoice balance from real payments and credit notes (`fix(receivables): derive invoice balance from payments and credit notes` - 7a4274d)
- [x] T2 — Payment receipt ticket auto-printed after an abono (`feat(receivables): print a payment receipt ticket after each abono` - ae717fa)
- [x] T3 — Payment history with receipt reprint (`feat(receivables): show payment history with receipt reprint` - 0bcff21)

## Acceptance Criteria
- Editing an invoice recalculates `balance` and `status` based on existing payments and credit notes.
- Registering an abono validates against the actual derived balance, records payment cleanly, and updates invoice balance and status.
- Registering an abono triggers ticket printing (silent if thermal printer configured in Electron) with business header, invoice info, full payment list with marked current payment, and pending balance ("RESTA").
- `PaymentDialog` handles balance 0 correctly without falling back to total.
- Receivables page displays accurate pending balance derived from payments, plus a "Historial" dialog with reprint capability.
- `npx tsc --noEmit` and `npx eslint` pass cleanly.

## Progress
- 2026-11-19: T0 completed. Task specification created and Engram mirror initialized.
- 2026-11-19: T1 completed (commit 7a4274d). Implemented `lib/receivables/invoice-balance.ts` with `computeInvoiceBalance` and batch helper; wired `updateInvoice` to recompute balance/status on update; updated `registerPayment` to validate against derived balance, handle insert error, and write recomputed balance. tsc and eslint pass.
- 2026-11-19: T2 completed (commit ae717fa). Created `components/modules/receivables/payment-receipt-template.tsx` (80mm thermal ticket); added `getPaymentReceipt` server action; updated `PaymentDialog` with auto-print, success state (reprint & close), and fixed `balance || total` bug. tsc and eslint pass.
- 2026-11-19: T3 completed (commit 0bcff21). Added `getInvoicePaymentHistory` in `actions/receivables-actions.ts`. Created `components/modules/receivables/payment-history-dialog.tsx` displaying all invoice payments, totals (Total factura, Total abonado, Resta), and reprint per payment. Updated `app/(dashboard)/receivables/page.tsx` with batch-derived pending balance and added "Historial" button. Verified no invoice detail page with payments section exists (invoices page uses list + preview modal; noted and skipped invoice detail page integration). tsc and eslint pass.
