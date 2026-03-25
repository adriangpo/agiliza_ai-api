// tests/rls/tenant_isolation.spec.ts
// INFRA-05, INFRA-07: RLS contract tests.
// These tests verify the tenant isolation guarantees at the database layer.
// A CI failure here means the RLS contract is broken — treat as critical.
//
// Phase 1 tests: tenants table (not tenant-scoped) + set_config behavior
//                + FORCE RLS enforcement via transient TEMP TABLE
// Phase 2+: Add tests for each new tenant-scoped table (users, reports, etc.)
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { uuidv7 } from 'uuidv7'

test.group('RLS: Tenant Isolation Contract', (group) => {
  // Per-test transaction rollback — all inserts and DDL are undone after each test
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('tenants table: two tenants can coexist (tenants table is not tenant-scoped)', async ({
    assert,
  }) => {
    const tenantAId = uuidv7()
    const tenantBId = uuidv7()

    await db.table('tenants').insert([
      { id: tenantAId, name: 'Tenant A', slug: 'tenant-a' },
      { id: tenantBId, name: 'Tenant B', slug: 'tenant-b' },
    ])

    const rows = await db.from('tenants').whereIn('id', [tenantAId, tenantBId]).select('id', 'name')

    assert.lengthOf(rows, 2, 'Both tenants should be visible (tenants table has no RLS)')
  })

  test('set_config with is_local=true: value is visible within the same transaction', async ({
    assert,
  }) => {
    const tenantId = uuidv7()

    await db.transaction(async (trx) => {
      await trx.rawQuery(`SELECT set_config('app.tenant_id', ?, ?)`, [tenantId, 'true'])

      const result = await trx.rawQuery(
        `SELECT current_setting('app.tenant_id', true) AS tenant_id`
      )
      assert.equal(
        result.rows[0].tenant_id,
        tenantId,
        'set_config value must be visible within the same transaction'
      )
    })
  })

  test('set_config with is_local=true: value is NULL outside transaction (connection pool safety)', async ({
    assert,
  }) => {
    const tenantId = uuidv7()

    // Set the config inside a transaction
    await db.transaction(async (trx) => {
      await trx.rawQuery(`SELECT set_config('app.tenant_id', ?, ?)`, [tenantId, 'true'])
    })
    // Transaction has ended — is_local=true means the setting was reset

    // Query OUTSIDE the transaction — should return NULL or empty string
    const result = await db.rawQuery(
      `SELECT current_setting('app.tenant_id', true) AS tenant_id`
    )
    const value = result.rows[0].tenant_id

    assert.isTrue(
      value === null || value === '' || value === 'null',
      `set_config with is_local=true must reset after transaction end. Got: ${value}`
    )
  })

  test('FORCE RLS enforcement: tenant A cannot read tenant B rows at DB layer', async ({
    assert,
  }) => {
    // ROADMAP Phase 1 success criterion 2: tenant A cannot read tenant B data — fails at DB layer.
    // Uses a transient TEMP TABLE so this test is self-contained and requires no feature tables.
    // TEMP TABLEs are session-local and implicitly dropped when the connection closes.
    const tenantAId = uuidv7()
    const tenantBId = uuidv7()

    await db.transaction(async (trx) => {
      // Create a temporary tenant-scoped table with FORCE ROW LEVEL SECURITY
      await trx.rawQuery(`
        CREATE TEMP TABLE test_rls_items (
          id SERIAL PRIMARY KEY,
          tenant_id UUID NOT NULL
        )
      `)

      // Enable RLS and FORCE it (prevents table owner from bypassing)
      await trx.rawQuery(`ALTER TABLE test_rls_items ENABLE ROW LEVEL SECURITY`)
      await trx.rawQuery(`ALTER TABLE test_rls_items FORCE ROW LEVEL SECURITY`)

      // Create the canonical tenant isolation policy (matches D-11 pattern)
      await trx.rawQuery(`
        CREATE POLICY tenant_isolation ON test_rls_items
          USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
          WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
      `)

      // Insert one row for tenant A and one row for tenant B
      await trx.rawQuery(`INSERT INTO test_rls_items (tenant_id) VALUES (?), (?)`, [
        tenantAId,
        tenantBId,
      ])

      // Query as tenant A — should see only tenant A's row
      await trx.rawQuery(`SELECT set_config('app.tenant_id', ?, true)`, [tenantAId])
      const resultA = await trx.rawQuery(`SELECT tenant_id FROM test_rls_items`)
      assert.lengthOf(resultA.rows, 1, 'Tenant A should see exactly 1 row (their own)')
      assert.equal(
        resultA.rows[0].tenant_id,
        tenantAId,
        'The visible row must belong to tenant A'
      )

      // Query as tenant B — should see only tenant B's row
      await trx.rawQuery(`SELECT set_config('app.tenant_id', ?, true)`, [tenantBId])
      const resultB = await trx.rawQuery(`SELECT tenant_id FROM test_rls_items`)
      assert.lengthOf(resultB.rows, 1, 'Tenant B should see exactly 1 row (their own)')
      assert.equal(
        resultB.rows[0].tenant_id,
        tenantBId,
        'The visible row must belong to tenant B'
      )
    })
  })

  test('FORCE RLS null safety: no tenant_id set returns zero rows', async ({ assert }) => {
    // When app.tenant_id is not set, current_setting returns NULL.
    // NULL::uuid never equals any real uuid — so zero rows are returned.
    const tenantId = uuidv7()

    await db.transaction(async (trx) => {
      // Same TEMP TABLE + policy setup as the enforcement test
      await trx.rawQuery(`
        CREATE TEMP TABLE test_rls_null_items (
          id SERIAL PRIMARY KEY,
          tenant_id UUID NOT NULL
        )
      `)
      await trx.rawQuery(`ALTER TABLE test_rls_null_items ENABLE ROW LEVEL SECURITY`)
      await trx.rawQuery(`ALTER TABLE test_rls_null_items FORCE ROW LEVEL SECURITY`)
      await trx.rawQuery(`
        CREATE POLICY tenant_isolation ON test_rls_null_items
          USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
          WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
      `)

      await trx.rawQuery(`INSERT INTO test_rls_null_items (tenant_id) VALUES (?)`, [tenantId])

      // Do NOT set app.tenant_id — it remains NULL
      const result = await trx.rawQuery(`SELECT tenant_id FROM test_rls_null_items`)
      assert.lengthOf(
        result.rows,
        0,
        'With no tenant_id set, RLS must return zero rows (NULL::uuid never matches)'
      )
    })
  })
})
