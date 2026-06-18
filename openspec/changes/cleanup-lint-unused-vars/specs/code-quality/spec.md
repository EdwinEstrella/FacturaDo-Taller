# Code Quality Specification

## Purpose

Ensure the lint/typecheck cleanup leaves the project in a warning-free, type-safe, build-verifiable state without changing product behavior.

## Requirements

### Requirement: Warning-Free Lint Baseline

The system MUST have a lint baseline where the configured lint command completes successfully with zero errors and zero warnings.

#### Scenario: Lint reports no problems

- GIVEN the repository after the cleanup change
- WHEN `npm run lint` is run
- THEN the command MUST exit successfully
- AND the lint output MUST report zero errors
- AND the lint output MUST report zero warnings

### Requirement: Typecheck Passes

The system MUST have a TypeScript baseline where the configured typecheck command completes successfully.

#### Scenario: Typecheck succeeds

- GIVEN the repository after the cleanup change
- WHEN `npx tsc --noEmit` is run
- THEN the command MUST exit successfully
- AND no TypeScript diagnostic MUST block the command

### Requirement: Build Verification

The system MUST either complete the configured build command successfully or document evidence that any build failure is unrelated to this cleanup change and caused by pre-existing, environmental, or configuration conditions outside the change scope.

#### Scenario: Build succeeds

- GIVEN the repository after the cleanup change
- WHEN `npm run build` is run in a suitable environment
- THEN the command MUST exit successfully

#### Scenario: Build is blocked by an unrelated condition

- GIVEN the repository after the cleanup change
- AND the build environment or existing configuration prevents a successful build for reasons unrelated to lint/typecheck cleanup
- WHEN `npm run build` is run
- THEN the blocker MUST be documented with the observed command output or diagnostic
- AND the blocker MUST be identified as unrelated, pre-existing, environmental, or configuration-specific
- AND the cleanup change MUST still satisfy lint and typecheck requirements

### Requirement: Behavior Preservation

The cleanup MUST NOT intentionally change runtime behavior, user-visible behavior, public component contracts, Electron IPC behavior, or application configuration semantics.

#### Scenario: Unused symbol cleanup preserves behavior

- GIVEN code that contains a currently unused import, variable, parameter, destructured value, or obsolete unused-vars suppression
- WHEN the cleanup change removes or renames only the unused symbol or suppression
- THEN the surrounding feature behavior MUST remain equivalent
- AND no new product behavior MUST be introduced

### Requirement: Unreproduced Any-To-Never Regression Watch

The previously reported TypeScript diagnostic, `argument of type 'any' is not assignable to parameter of type 'never'`, MUST be treated as an unreproduced regression watch item rather than a known failing baseline.

#### Scenario: Typecheck remains free of the watched diagnostic

- GIVEN baseline typecheck did not reproduce the `any` to `never` diagnostic
- WHEN `npx tsc --noEmit` is run after the cleanup change
- THEN the watched diagnostic MUST NOT appear
- AND the cleanup change MUST NOT document the watched diagnostic as an accepted or known failing baseline

#### Scenario: Watched diagnostic appears during verification

- GIVEN the `any` to `never` diagnostic appears during post-cleanup verification
- WHEN verification results are recorded
- THEN the diagnostic MUST be treated as a regression or newly reproduced issue requiring evidence and follow-up
- AND it MUST NOT be accepted as part of the lint cleanup baseline without an explicit decision
