# Prevent Duplicate Products, Editable Line Price, Fix Decimal Input Validation

## Objective
Prevent duplicate products in the catalog through name normalization, enable editable unit prices per line item in invoices and quotes, and fix decimal input validation issues in the product dialog.

## Problem
Users previously created duplicate products with identical or slightly differing names (varying whitespace, diacritics, or casing) simply to sell the same product at different prices to different customers. Additionally, browser validation for decimal inputs in the product dialog failed when editing fractional stock values due to missing minimum bounds and restrictive step intervals.

## Scope
- T1 — `lib/product-name.ts`: Export `normalizeProductName` and `cleanProductName` helpers to handle whitespace collapsing, Spanish locale lowercasing, and diacritic removal.
- T2 — `actions/product-actions.ts`: Clean stored product names in `ProductSchema`, verify duplicate names via `findDuplicateProductName` before insert/update, and align error responses to `{ error: ... }`.
- T3 — `components/modules/products/product-dialog.tsx`: Render error messages inline inside the dialog instead of silently closing, and resolve browser numeric input validation with `step="any"` and `min="0"`.
- T4 — `components/modules/invoices/invoice-form.tsx`: Add editable unit price input per line with RD$ indicator, non-negative validation, and Enter key submission prevention.
- T5 — `odd/tasks/product-dedupe-line-price.md`: Task documentation and tracking specification.
- T6 — DB merge of 7 duplicate product groups + unique index on normalized name — run by the orchestrator after user approval.

## Constraints
- All user-facing UI copy in Spanish (existing project convention).
- Code identifiers and comments in English.
- No native popups (`alert`/`confirm`/`prompt`); errors are displayed inline inside the dialog.
- Do not commit, do not push, do not touch database tables directly.
- TDD: off (no test runner in project).
- Route: delegated to agy.

## Checks
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

## Tasks
- [ ] T1 `lib/product-name.ts`: export `normalizeProductName` and `cleanProductName` helpers
- [ ] T2 `actions/product-actions.ts`: schema cleanup, duplicate detection helper and inline error response
- [ ] T3 `components/modules/products/product-dialog.tsx`: inline error display and decimal validation step fix
- [ ] T4 `components/modules/invoices/invoice-form.tsx`: editable unit price input per line
- [ ] T5 `odd/tasks/product-dedupe-line-price.md`: task specification document
- [ ] T6 DB merge of 7 duplicate product groups + unique index on normalized name — run by the orchestrator after user approval
