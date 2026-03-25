// japa.config.ts
// INFRA-07: Test file discovery configuration.
// Suites match adonisrc.ts suites definitions.
// D-03: Feature tests at app/features/**/tests/
// D-04: Cross-cutting tests at tests/rls/ and tests/integration/
//
// NOTE: AdonisJS v7 test runner is launched via `node ace test` (bin/test.ts entrypoint).
// Test suites are defined in adonisrc.ts and consumed by bin/test.ts.
// This file documents the suite structure and re-exports bootstrap config.
// Do NOT run this file directly — always use: NODE_ENV=test node ace test

export { plugins, runnerHooks } from './tests/bootstrap.js'

// Suite definitions (matches adonisrc.ts suites — keep in sync):
// {
//   name: 'unit',
//   files: ['app/features/**/tests/unit/**/*.spec.ts'],
//   timeout: 2000,
// },
// {
//   name: 'functional',
//   files: ['app/features/**/tests/functional/**/*.spec.ts'],
//   timeout: 30_000,
// },
// {
//   name: 'rls',
//   files: ['tests/rls/**/*.spec.ts'],
//   timeout: 30_000,
// },
// {
//   name: 'integration',
//   files: ['tests/integration/**/*.spec.ts'],
//   timeout: 30_000,
// },
