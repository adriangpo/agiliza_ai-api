// tests/bootstrap.ts
// INFRA-07: Japa v5 test harness bootstrap.
// Configures plugins, starts HTTP server, runs migrations, and sets up per-test transaction rollback.
//
// Per-test transaction rollback pattern (use in any test group that touches the DB):
//   test.group('GroupName', (group) => {
//     group.each.setup(() => testUtils.db().withGlobalTransaction())
//   })
// This wraps each test in a transaction that auto-rolls-back after the test completes.
// The global transaction uses the same DB connection that set_config calls use, so
// RLS context set via set_config inside a test is properly scoped.
import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import type { Config } from '@japa/runner/types'

export const plugins: Config['plugins'] = [assert(), apiClient(), pluginAdonisJS(app)]

let closeHttpServer: (() => Promise<void>) | undefined

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [
    // Start the HTTP test server on a random port (used by functional + rls + integration suites)
    async () => {
      closeHttpServer = await testUtils.httpServer().start()
    },
    // Run all pending migrations against the test DB (NODE_ENV=test → PG_TEST_DB_NAME).
    // Uses pg_migrator connection (DDL role) — the 'app' role (default pg connection) has no DDL perms.
    () => testUtils.db('pg_migrator').migrate(),
    // Grant INSERT on tenants to app role for test isolation.
    // In production, only migrator role can insert tenants (admin-only operation).
    // Tests need to create test tenants directly from the app connection for withGlobalTransaction()
    // to work correctly (test data must be visible to the HTTP server on the same connection).
    async () => {
      const { default: db } = await import('@adonisjs/lucid/services/db')
      await db.connection('pg_migrator').rawQuery('GRANT INSERT ON tenants TO app')
    },
  ],
  teardown: [() => closeHttpServer?.()],
}
