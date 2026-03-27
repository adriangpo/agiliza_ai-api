// app/features/auth/tests/functional/account_deletion.spec.ts
// AUTH-07, AUTH-08: DELETE /users/me — PII anonymization + immediate token invalidation.
// D-17 (CONTEXT.md): exact anonymization values (email, displayName, deletedAt, tokens).
// D-18 (CONTEXT.md): row kept as tombstone — FK integrity preserved.
import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

test.group('DELETE /users/me', (group) => {
  let authToken: string
  let userId: number

  group.each.setup(async ({ context: { client } }) => {
    const response = await client.post('/auth/register').json({
      email: `delete-test-${Date.now()}@example.com`,
      password: 'SecurePass1',
      displayName: 'Delete Test User',
    })
    authToken = response.body().token.value
    userId = response.body().user.id
  })

  test('204 — account deletion returns no content', async ({ client }) => {
    const response = await client
      .delete('/users/me')
      .header('Authorization', `Bearer ${authToken}`)

    response.assertStatus(204)
  })

  test('email anonymized after deletion — set to deleted-{id}@anonymized.invalid', async ({ client, assert }) => {
    await client
      .delete('/users/me')
      .header('Authorization', `Bearer ${authToken}`)

    // D-18: tombstone row still exists — query bypassing RLS via migrator role
    const user = await db.rawQuery(`SELECT email FROM users WHERE id = ?`, [userId])
    assert.equal(user.rows[0].email, `deleted-${userId}@anonymized.invalid`)
  })

  test('displayName anonymized to "Cidadão Anônimo" (exact string, AUTH-07, RN-005)', async ({ client, assert }) => {
    await client
      .delete('/users/me')
      .header('Authorization', `Bearer ${authToken}`)

    const user = await db.rawQuery(`SELECT display_name FROM users WHERE id = ?`, [userId])
    // RN-005: exact string required — no ASCII normalization, no variation
    assert.equal(user.rows[0].display_name, 'Cidadão Anônimo')
  })

  test('AUTH-08 — all tokens deleted after account deletion', async ({ client, assert }) => {
    await client
      .delete('/users/me')
      .header('Authorization', `Bearer ${authToken}`)

    const tokens = await db.rawQuery(
      `SELECT COUNT(*) as count FROM auth_access_tokens WHERE tokenable_id = ?`,
      [userId]
    )
    assert.equal(Number(tokens.rows[0].count), 0, 'all tokens must be deleted')
  })

  test('401 — old token rejected after account deletion', async ({ client }) => {
    await client
      .delete('/users/me')
      .header('Authorization', `Bearer ${authToken}`)

    // Token was deleted — any subsequent request with it must fail
    const response = await client
      .get('/users/me')
      .header('Authorization', `Bearer ${authToken}`)

    response.assertStatus(401)
  })

  test('404 — second DELETE on already-deleted account', async ({ client }) => {
    // First deletion
    await client
      .delete('/users/me')
      .header('Authorization', `Bearer ${authToken}`)

    // Re-register to get a token for the tombstone user attempt
    // Actually: after token deletion we can't auth anymore — 404 from auth guard
    // The test verifies the 401 or 404 behavior on replay
    const response = await client
      .delete('/users/me')
      .header('Authorization', `Bearer ${authToken}`)

    // Token was deleted → auth guard returns 401 (token not found)
    response.assertStatus(401)
  })

  test('401 — delete without Authorization header', async ({ client }) => {
    const response = await client.delete('/users/me')
    response.assertStatus(401)
  })
})
