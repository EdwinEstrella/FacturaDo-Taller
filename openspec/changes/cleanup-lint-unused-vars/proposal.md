# Change Proposal: Cleanup Current Lint Warnings

## Intent

Remove the repository's current lint warnings so `npm run lint` completes with zero warnings and zero errors, without changing runtime behavior.

The parent baseline reports:

- `npm run lint` exits `0` but reports 12 warnings.
- All current warnings are `@typescript-eslint/no-unused-vars`.
- `npx tsc --noEmit` exits `0`.
- The initially reported type error, `argument of type 'any' is not assignable to parameter of type 'never'`, was not reproduced by baseline typecheck.
- `npm run build` has not yet been run in this phase.

## Scope

In scope:

- Remove or rename currently unused imports, variables, parameters, and destructured values that trigger `@typescript-eslint/no-unused-vars`.
- Prefer minimal code edits that preserve existing behavior.
- Remove local `eslint-disable` comments for unused-vars when the underlying unused symbol can be cleaned up safely.
- Keep the changed-line footprint below the configured 400-line review budget.
- Verify with:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run build` when feasible

Out of scope:

- Product behavior changes.
- Refactors unrelated to current lint warnings.
- ESLint rule relaxations or broad config changes to hide warnings.
- Fixing unobserved or non-reproducible type errors unless they appear during verification.
- Electron packaging or installer validation beyond the configured build command.

## Affected Areas

Expected affected areas are limited to files currently reporting or suppressing unused-variable lint concerns, including likely candidates identified during exploration:

- `components/layout/app-sidebar.tsx`
- `electron/main.js`
- `electron/db-manager.js`
- Any other files surfaced by the apply-phase lint run with `@typescript-eslint/no-unused-vars` warnings

Configuration and OpenSpec context reviewed:

- `openspec/config.yaml`
- `package.json`
- `eslint.config.mjs`
- `AGENTS.md` project instructions from parent context

## Approach

1. Re-run `npm run lint` at apply start to capture the exact current warning list.
2. For each `@typescript-eslint/no-unused-vars` warning:
   - Remove unused imports or local declarations when they have no side effects.
   - Rename intentionally unused parameters to an accepted underscore form only if required for API/signature compatibility and allowed by the active lint configuration.
   - Keep exported/public component and IPC behavior unchanged.
   - Avoid editing generated, ignored, or dependency files.
3. Re-run lint after edits until no warnings remain.
4. Re-run typecheck to ensure cleanup did not alter TypeScript validity.
5. Run `npm run build` if the environment allows; record any pre-existing or environment-specific build blocker separately.

## Risks

- Some symbols may appear unused to ESLint but be intentionally reserved for future IPC, Electron lifecycle, or component API compatibility.
- Removing destructured imports from Electron/CommonJS files could accidentally remove a side-effectful require if done too broadly.
- `npm run build` may reveal unrelated build-time issues not present in lint/typecheck.
- Existing pre-SDD git changes (`.gitignore` modified, `.pi/` untracked) must be preserved and not conflated with this cleanup.

## Rollback Plan

- Revert only the files modified for this change.
- Restore any removed lint-disable comments or unused symbols if verification or runtime smoke checks indicate they were required.
- Leave pre-existing `.gitignore` and `.pi/` changes untouched.

## Success Criteria

- `npm run lint` exits `0` with zero warnings and zero errors.
- `npx tsc --noEmit` exits `0`.
- `npm run build` exits `0`, or any failure is documented as unrelated/pre-existing/environmental with evidence.
- No intentional behavior changes are introduced.
- Total changed lines remain under 400.
- OpenSpec artifacts document the proposal and subsequent implementation/verification phases.
