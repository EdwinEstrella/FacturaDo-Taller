# Point of Sale (POS) Module

## Objective
Give the shop a dedicated "Punto de Venta" screen for fast sales, and stop creating invoices from the Invoices list/dashboard. The POS is the only place to start a new sale.

## Problem / Why
Selling through the generic invoice form is slow, and the e-CF "Sin comprobante" switch is buried in it. The owner wants a dedicated sales module where the switch is visible and ON by default (sale is NOT sent to DGII); turning it OFF on a given sale issues the e-CF (E31/E32) and sends it to DGII.

## Scope
- New route `app/(dashboard)/pos/page.tsx` (server) + client component under `components/modules/pos/`.
- Sidebar entry "Punto de Venta" (first sales item), gated by the same permission as creating invoices.
- POS layout: product search + product grid/list (left), cart with qty/price/line remove, client selector (optional, default walk-in "Consumidor final" behavior the invoice form already uses), payment method, totals, prominent "Sin comprobante" switch (ON by default, only when `ecfEnabled`), big "Cobrar" button.
- Saving reuses the existing invoice creation server action and payload shape from `invoice-form.tsx` (no new fiscal logic, no new migration).
- After a successful sale: success state with "Imprimir" (reuse existing print utilities/silent thermal printing from `lib/print-utils.ts`) and "Nueva venta" (resets cart).
- Remove "Nueva Factura" buttons from `app/(dashboard)/invoices/page.tsx` (both) and `app/(dashboard)/page.tsx`; replace with a link/button to `/pos` labelled "Punto de Venta".
- Keep `/invoices/create` route working for quote conversion (`sourceQuoteId`), quotes (`type=QUOTE`) and existing flows.

## Constraints
- All dialogs/popups internal (shadcn/Radix), never native alert/confirm/prompt.
- UI copy in Spanish (project convention), code identifiers/comments in English.
- No changes to `.env.local`; no git checkout/restore/stash/reset/clean.
- Planning heuristic ~400 changed lines per task (advisory only).

## TDD
Resolved OFF (project setting, see electronic-invoicing.md). Checks: `npx tsc --noEmit -p .`, `npx eslint` on touched files, manual render of `/pos` against dev server.

## Tasks
- [x] POS-1 — POS page + client component, sidebar entry, reuse invoice create action, print + new sale. Route: delegated (agy), writer trigger (2+ non-trivial files).
- [x] POS-2 — Remove "Nueva Factura" buttons, point to `/pos`. Route: delegated with POS-1.
- [ ] POS-3 — Release 1.1.3.

## Acceptance
- `/pos` renders, adds products, shows the switch ON by default when e-CF is enabled, saves an invoice that appears in Invoices, can print.
- No "Nueva Factura" button remains on invoices list or dashboard.
- tsc passes.

## Progress
- 2026-11-17: document created.
- 2026-11-17: POS-1 and POS-2 implemented. POS terminal built with product catalog, cart, totals (identical e-CF/no receipt math), "Sin comprobante" switch default ON, success dialog with silent thermal print flow, sidebar navigation and dashboard/invoice links updated to /pos. tsc and eslint pass with 0 errors.
