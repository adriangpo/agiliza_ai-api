// app/features/auth/tests/functional/register.spec.ts
// AUTH-01: Registration — email/password, tenant-scoped.
// Tests run in transaction (Phase 1 Japa config) — DB state rolls back after each test.
// X-Tenant-ID header required: PublicTenantMiddleware resolves tenant context for public routes.
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { uuidv7 } from 'uuidv7'

test.group('POST /auth/register', (group) => {
  // Wrap default (app) connection in a global transaction — all test queries and HTTP server
  // queries use the same connection and see the same uncommitted data (tenant, users, tokens).
  // DB rolls back automatically after each test — no persistent state between tests.
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  let tenantId: string

  group.each.setup(async () => {
    tenantId = uuidv7()
    // Insert test tenant via app connection (within the global transaction).
    // In test DB, app role has INSERT granted on tenants for test isolation purposes.
    // In production, only migrator role can insert tenants (admin-only operation).
    await db
      .table('tenants')
      .insert({ id: tenantId, name: 'Test Tenant', slug: `tenant-${tenantId}` })
  })

  test('201 — valid registration returns token and public user profile', async ({
    client,
    assert,
  }) => {
    const response = await client.post('/auth/register').header('X-Tenant-ID', tenantId).json({
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
    await client.post('/auth/register').header('X-Tenant-ID', tenantId).json({
      email: 'duplicate@example.com',
      password: 'SecurePass1',
      displayName: 'First User',
    })

    const response = await client.post('/auth/register').header('X-Tenant-ID', tenantId).json({
      email: 'duplicate@example.com',
      password: 'SecurePass1',
      displayName: 'Second User',
    })

    response.assertStatus(409)
    response.assertBodyContains({ message: 'Este e-mail já está registrado neste município.' })
  })

  test('422 — password too short returns VineJS errors array', async ({ client, assert }) => {
    const response = await client.post('/auth/register').header('X-Tenant-ID', tenantId).json({
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
    const response = await client.post('/auth/register').header('X-Tenant-ID', tenantId).json({
      email: 'not-an-email',
      password: 'SecurePass1',
      displayName: 'Test User',
    })

    response.assertStatus(422)
    response.assertBodyContains({ errors: [{ field: 'email' }] })
  })
})
