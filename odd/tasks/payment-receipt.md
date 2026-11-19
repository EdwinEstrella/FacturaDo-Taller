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
- 2026-11-19: Review round 1 completed (commits dc761e3, 4b89d05). Addressed review findings F1–F5:
  - F1: Fixed `updateInvoice` regression on legacy PAID invoices without payment rows by calculating balance delta against `existingInvoice` using pure `rebalanceAfterTotalChange` instead of querying the payment ledger (`dc761e3`).
  - F2: `computeInvoiceBalance` and `computeBatchInvoiceBalances` now throw on query errors instead of silently swallowing them; extracted pure `deriveBalance`; receivables page catches batch error and falls back to stored balance (`dc761e3`).
  - F3: Receipts are generated "as of that payment" by slicing payments up to and including the selected payment and deriving historical balance and total paid via `getPaymentReceipt(paymentId)` using shared private loader `loadInvoicePaymentBase` (`4b89d05`).
  - F4: Extracted unified printer hook and offscreen portal `usePaymentReceiptPrinter` in `components/modules/receivables/use-payment-receipt-printer.tsx`, eliminating `setTimeout` races and ref flags in both `PaymentDialog` and `PaymentHistoryDialog`, with support for consecutive reprints (`4b89d05`).
  - F5: Removed gray background (`bg-slate-100`) from current payment row in `payment-receipt-template.tsx` to prevent thermal dithering artifacts (`4b89d05`).
- 2026-11-19: Review round 2 completed (commit 9b64f96). Addressed review findings G1–G2:
  - G1: Simplified `usePaymentReceiptPrinter` hook: stored latest `print` in ref outside effect deps, tracked mount state with `mountedRef`, made effect depend strictly on `printToken` with `finally { if (mountedRef.current) setPrintingId(null) }`, and replaced `ReceiptPortal` component function with direct `receiptElement: React.ReactNode` in hook and consumer dialogs (`9b64f96`).
  - G2: Removed redundant JavaScript re-sort and intermediate `rawPayments` mapping in `loadInvoicePaymentBase` (`actions/receivables-actions.ts`), relying directly on database ordering (`9b64f96`).

## Review round 1

Findings resolved:
- **F1 (critical) – Legacy paid invoices preserved on edit**: Exported `rebalanceAfterTotalChange(oldTotal, oldBalance, newTotal)` in `lib/receivables/invoice-balance.ts`. In `updateInvoice` (`actions/invoice-actions.ts`), loaded `existingInvoice` with `total` and `balance`, deriving `newBalance` from the delta so legacy PAID invoices without payment records do not revert to PENDING on edit (`dc761e3`).
- **F2 (critical) – Throw on query errors & deduplicate balance math**: `computeInvoiceBalance` and `computeBatchInvoiceBalances` throw immediately if `Payment` or `CreditNote` queries fail. Per-row balance math deduplicated into pure function `deriveBalance(total, paid, credited)`. `app/(dashboard)/receivables/page.tsx` catches batch errors and falls back to stored invoice balance (`dc761e3`).
- **F3 – Historical receipt as of selected payment**: Server action `getPaymentReceipt(paymentId)` filters payments ordered by `date` asc then `createdAt` asc up to and including the target payment, computing `totalPaid` and `balance` (RESTA) as of that point. Shared private loader `loadInvoicePaymentBase` in `actions/receivables-actions.ts` deduplicates invoice, payments, credit notes, and settings retrieval with fail-fast error checking (`4b89d05`).
- **F4 – Unified printer hook without setTimeout races**: Implemented `usePaymentReceiptPrinter()` in `components/modules/receivables/use-payment-receipt-printer.tsx` returning `{ printReceipt, printingId, isPrinting, ReceiptPortal }`. Renders offscreen ticket, waits for layout/DOM commit via `requestAnimationFrame`, calls `useInvoicePrint({ format: "ticket" }).print()`, and supports consecutive prints via token counter. Integrated in both `PaymentDialog` and `PaymentHistoryDialog` (`4b89d05`).
- **F5 – Thermal-friendly highlight**: Removed `bg-slate-100` and rounded border from current payment row in `payment-receipt-template.tsx`, retaining bold font and black `← este abono` to avoid gray dithering on thermal receipt paper (`4b89d05`).

## Review round 2

Findings resolved:
- **G1 – Reliable receipt printer hook across rerenders**: In `components/modules/receivables/use-payment-receipt-printer.tsx`, eliminated the `activeTokenRef` drop bug where identity changes in `print` cancelled the rAF frame and left buttons stuck in the busy state. Kept `print` in `printRef.current` without listing it as an effect dependency, tied the effect strictly to `printToken`, ensured `setPrintingId(null)` in `finally` via `mountedRef`, allowed consecutive prints of the same receipt, and replaced `useCallback`-generated `ReceiptPortal` with direct `receiptElement: React.ReactNode` consumed in `PaymentDialog` and `PaymentHistoryDialog` (`9b64f96`).
- **G2 – Removed redundant sort in loadInvoicePaymentBase**: In `actions/receivables-actions.ts`, removed the redundant in-memory `rawPayments.sort()` and intermediate mapping in `loadInvoicePaymentBase`, mapping query rows once directly to `allPayments` since the database query already specifies `.order('date', { ascending: true }).order('createdAt', { ascending: true })` (`9b64f96`).

Review round 3: StrictMode mounted flag fix (552a76c)
