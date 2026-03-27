// app/features/auth/tests/functional/account_deletion.spec.ts
// AUTH-07, AUTH-08: DELETE /users/me — PII anonymization + immediate token invalidation.
// D-17 (CONTEXT.md): exact anonymization values (email, displayName, deletedAt, tokens).
// D-18 (CONTEXT.md): row kept as tombstone — FK integrity preserved.
// X-Tenant-ID header required for register (PublicTenantMiddleware).
// DELETE uses Authorization Bearer (TenantMiddleware via auth.user).
//
// IMPORTANT: Uses withGlobalTransaction() for test isolation.
// The publicTenantMiddleware sets app.tenant_id via set_config inside db.transaction().
// Controllers use global Lucid models (not ctx.db), which rely on the withGlobalTransaction()
// outer connection having app.tenant_id set from the publicTenantMiddleware's savepoint.
// Without withGlobalTransaction(), the global model connection has no app.tenant_id set,
// causing RLS violations. This is a known constraint: all auth tests must use withGlobalTransaction().
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { uuidv7 } from 'uuidv7'

test.group('DELETE /users/me', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  let authToken: string
  let userId: number

  group.each.setup(async ({ context: { client } }) => {
    const tenantId = uuidv7()
    await db
      .table('tenants')
      .insert({ id: tenantId, name: 'Test Tenant', slug: `tenant-${tenantId}` })

    const response = await client
      .post('/auth/register')
      .header('X-Tenant-ID', tenantId)
      .json({
        email: `delete-test-${Date.now()}@example.com`,
        password: 'SecurePass1',
        displayName: 'Delete Test User',
      })
    authToken = response.body().token.value
    userId = response.body().user.id
  })

  test('204 — account deletion returns no content', async ({ client }) => {
    const response = await client.delete('/users/me').header('Authorization', `Bearer ${authToken}`)

    response.assertStatus(204)
  })

  test('email anonymized after deletion — set to deleted-{id}@anonymized.invalid', async ({
    client,
    assert,
  }) => {
    await client.delete('/users/me').header('Authorization', `Bearer ${authToken}`)

    // D-18: tombstone row still exists — direct DB query within the test transaction
    // Note: Lucid rawQuery uses ? for positional bindings (not $1 PostgreSQL syntax)
    const user = await db.rawQuery(`SELECT email FROM users WHERE id = ?`, [userId])
    assert.equal(user.rows[0].email, `deleted-${userId}@anonymized.invalid`)
  })

  test('displayName anonymized to "Cidadão Anônimo" (exact string, AUTH-07, RN-005)', async ({
    client,
    assert,
  }) => {
    await client.delete('/users/me').header('Authorization', `Bearer ${authToken}`)

    const user = await db.rawQuery(`SELECT display_name FROM users WHERE id = ?`, [userId])
    // RN-005: exact string required — no ASCII normalization, no variation
    assert.equal(user.rows[0].display_name, 'Cidadão Anônimo')
  })

  test('AUTH-08 — all tokens deleted after account deletion', async ({ client, assert }) => {
    await client.delete('/users/me').header('Authorization', `Bearer ${authToken}`)

    const tokens = await db.rawQuery(
      `SELECT COUNT(*) as count FROM auth_access_tokens WHERE tokenable_id = ?`,
      [userId]
    )
    assert.equal(Number(tokens.rows[0].count), 0, 'all tokens must be deleted')
  })

  test('401 — old token rejected after account deletion', async ({ client }) => {
    await client.delete('/users/me').header('Authorization', `Bearer ${authToken}`)

    // Token was deleted — any subsequent request with it must fail
    const response = await client.get('/users/me').header('Authorization', `Bearer ${authToken}`)

    response.assertStatus(401)
  })

  test('401 — second DELETE on already-deleted account', async ({ client }) => {
    // First deletion
    await client.delete('/users/me').header('Authorization', `Bearer ${authToken}`)

    // Token was deleted → auth guard returns 401 (token not found)
    const response = await client.delete('/users/me').header('Authorization', `Bearer ${authToken}`)

    response.assertStatus(401)
  })

  test('401 — delete without Authorization header', async ({ client }) => {
    const response = await client.delete('/users/me')
    response.assertStatus(401)
  })
})
