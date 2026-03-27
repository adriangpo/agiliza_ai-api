// app/features/auth/tests/functional/profile.spec.ts
// AUTH-06: GET /users/me — public profile endpoint.
// Verifies response shape: id, displayName, joinedAt only.
// Verifies no sensitive fields: no email, no role, no tenantId, no password.
// X-Tenant-ID header required for register (PublicTenantMiddleware).
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { uuidv7 } from 'uuidv7'

test.group('GET /users/me', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  let authToken: string
  let userId: number

  group.each.setup(async ({ context: { client } }) => {
    const tenantId = uuidv7()
    await db
      .table('tenants')
      .insert({ id: tenantId, name: 'Test Tenant', slug: `tenant-${tenantId}` })

    const response = await client.post('/auth/register').header('X-Tenant-ID', tenantId).json({
      email: 'profile-test@example.com',
      password: 'SecurePass1',
      displayName: 'Profile Test User',
    })
    authToken = response.body().token.value
    userId = response.body().user.id
  })

  test('200 — authenticated user sees public profile', async ({ client, assert }) => {
    const response = await client.get('/users/me').header('Authorization', `Bearer ${authToken}`)

    response.assertStatus(200)
    const body = response.body()
    assert.exists(body.user)
    assert.equal(body.user.id, userId)
    assert.equal(body.user.displayName, 'Profile Test User')
    assert.isString(body.user.joinedAt)
  })

  test('200 — response does not contain email, role, tenantId, or password', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/users/me').header('Authorization', `Bearer ${authToken}`)

    response.assertStatus(200)
    const body = response.body()
    assert.notProperty(body.user, 'email', 'email must not be in public profile')
    assert.notProperty(body.user, 'role', 'role must not be in public profile')
    assert.notProperty(body.user, 'tenantId', 'tenantId must not be in public profile')
    assert.notProperty(body.user, 'password', 'password must not be in public profile')
  })

  test('401 — unauthenticated request returns 401', async ({ client }) => {
    const response = await client.get('/users/me')
    response.assertStatus(401)
  })
})
