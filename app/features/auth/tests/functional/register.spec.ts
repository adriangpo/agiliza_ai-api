// app/features/auth/tests/functional/register.spec.ts
// AUTH-01: Registration — email/password, tenant-scoped.
// Tests run in transaction (Phase 1 Japa config) — DB state rolls back after each test.
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('POST /auth/register', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('201 — valid registration returns token and public user profile', async ({
    client,
    assert,
  }) => {
    const response = await client.post('/auth/register').json({
      email: 'maria@example.com',
      password: 'SecurePass1',
      displayName: 'Maria Silva',
    })

    response.assertStatus(201)
    response.assertBodyContains({ token: { type: 'bearer' } })

    const body = response.body()
    assert.isString(body.token.value)
    assert.isTrue(body.token.value.startsWith('oat_'), 'token must start with oat_')
    assert.equal(body.user.displayName, 'Maria Silva')
    assert.isString(body.user.joinedAt)
    // AUTH-06: email, role, tenantId must NOT be in response
    assert.notProperty(body.user, 'email')
    assert.notProperty(body.user, 'role')
    assert.notProperty(body.user, 'tenantId')
    assert.notProperty(body.user, 'password')
  })

  test('409 — duplicate email in same tenant', async ({ client }) => {
    await client.post('/auth/register').json({
      email: 'duplicate@example.com',
      password: 'SecurePass1',
      displayName: 'First User',
    })

    const response = await client.post('/auth/register').json({
      email: 'duplicate@example.com',
      password: 'SecurePass1',
      displayName: 'Second User',
    })

    response.assertStatus(409)
    response.assertBodyContains({ message: 'Este e-mail já está registrado neste município.' })
  })

  test('422 — password too short returns VineJS errors array', async ({ client, assert }) => {
    const response = await client.post('/auth/register').json({
      email: 'test@example.com',
      password: 'short',
      displayName: 'Test User',
    })

    response.assertStatus(422)
    const body = response.body()
    assert.isArray(body.errors)
    assert.equal(body.errors[0].field, 'password')
  })

  test('422 — invalid email format', async ({ client }) => {
    const response = await client.post('/auth/register').json({
      email: 'not-an-email',
      password: 'SecurePass1',
      displayName: 'Test User',
    })

    response.assertStatus(422)
    response.assertBodyContains({ errors: [{ field: 'email' }] })
  })
})
