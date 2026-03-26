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
    // Run all pending migrations against the test DB (NODE_ENV=test → PG_TEST_DB_NAME)
    () => testUtils.db().migrate(),
  ],
  teardown: [() => closeHttpServer?.()],
}
