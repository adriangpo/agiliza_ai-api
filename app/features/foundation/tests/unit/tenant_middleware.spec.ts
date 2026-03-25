// INFRA-06: TenantMiddleware integration tests using real DB connection.
// Uses withGlobalTransaction() so each test rolls back — no test pollution.
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import TenantMiddleware from '#shared/middleware/tenant_middleware'
import { uuidv7 } from 'uuidv7'

test.group('TenantMiddleware', (group) => {
  // Wrap each test in a transaction that rolls back — standard Japa pattern
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('sets app.tenant_id via set_config with is_local=true inside a transaction', async ({
    assert,
  }) => {
    const tenantId = uuidv7()
    let nextCalled = false

    const mockCtx = {
      auth: { user: { tenantId } },
      tenantId: undefined as string | undefined,
      db: undefined as unknown,
    }

    const middleware = new TenantMiddleware()
    await middleware.handle(mockCtx as any, async () => {
      nextCalled = true

      // Verify set_config is visible within the transaction that next() runs inside
      const result = await db.rawQuery(`SELECT current_setting('app.tenant_id', true) AS tenant_id`)
      assert.equal(
        result.rows[0].tenant_id,
        tenantId,
        'set_config must be visible to next() inside the transaction'
      )
    })

    assert.isTrue(nextCalled, 'next() must be called')
    assert.equal(mockCtx.tenantId, tenantId, 'ctx.tenantId must be set')
  })

  test('set_config value resets after transaction ends (is_local=true safety)', async ({
    assert,
  }) => {
    const tenantId = uuidv7()
    const mockCtx = {
      auth: { user: { tenantId } },
      tenantId: undefined as string | undefined,
      db: undefined as unknown,
    }

    const middleware = new TenantMiddleware()
    await middleware.handle(mockCtx as any, async () => {})

    // Transaction has closed — is_local=true means setting must be reset
    const result = await db.rawQuery(`SELECT current_setting('app.tenant_id', true) AS tenant_id`)
    const value = result.rows[0].tenant_id
    assert.isTrue(
      value === null || value === '' || value === 'null',
      `set_config with is_local=true must reset after transaction end. Got: ${value}`
    )
  })
})
