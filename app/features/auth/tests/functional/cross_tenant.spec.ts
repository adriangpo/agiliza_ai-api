// app/features/auth/tests/functional/cross_tenant.spec.ts
// AUTH-01 + RLS contract: email is unique per tenant, not globally.
// Cross-tenant isolation: a user registered in tenant A cannot access tenant B's data.
// TenantMiddleware reads tenant from auth.user.tenantId — not from X-Tenant-ID header.
// So a token from tenant A always resolves to tenant A's context regardless of headers.
//
// NOTE: set_config with is_local=true inside nested transactions (savepoints) affects the
// outer transaction's session config. This means multi-tenant tests should use separate
// test groups (each with withGlobalTransaction) to avoid app.tenant_id contamination
// between sequential tenant-switching requests.
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { uuidv7 } from 'uuidv7'

test.group('Cross-tenant isolation / same email in different tenants', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  let tenantAId: string
  let tenantBId: string

  group.each.setup(async () => {
    tenantAId = uuidv7()
    tenantBId = uuidv7()
    await db
      .table('tenants')
      .insert({ id: tenantAId, name: 'Tenant A', slug: `tenant-a-${tenantAId}` })
    await db
      .table('tenants')
      .insert({ id: tenantBId, name: 'Tenant B', slug: `tenant-b-${tenantBId}` })
  })

  test('same email can register in different tenants', async ({ client }) => {
    // Register in tenant A — sets app.tenant_id = tenantAId
    const tenantAResponse = await client
      .post('/auth/register')
      .header('X-Tenant-ID', tenantAId)
      .json({
        email: 'cross-tenant@example.com',
        password: 'SecurePass1',
        displayName: 'Tenant A User',
      })
    tenantAResponse.assertStatus(201)

    // Register same email in tenant B — sets app.tenant_id = tenantBId
    // AUTH-01 + RLS: users.email has UNIQUE (tenant_id, email) constraint, not global UNIQUE
    // This confirms per-tenant email uniqueness — same email is allowed across tenants
    const tenantBResponse = await client
      .post('/auth/register')
      .header('X-Tenant-ID', tenantBId)
      .json({
        email: 'cross-tenant@example.com',
        password: 'SecurePass1',
        displayName: 'Tenant B User',
      })
    tenantBResponse.assertStatus(201)

    // Both registrations succeeded — cross-tenant email isolation confirmed
  })
})

test.group('Cross-tenant isolation / token resolves to correct tenant', (group) => {
  // Each test group uses a fresh withGlobalTransaction() boundary.
  // This ensures app.tenant_id is not contaminated from a prior registration request.
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  let tenantAId: string
  let tokenA: string
  let userAId: number

  group.each.setup(async ({ context: { client } }) => {
    tenantAId = uuidv7()
    await db
      .table('tenants')
      .insert({ id: tenantAId, name: 'Tenant A', slug: `tenant-a-${tenantAId}` })

    // Register user in tenant A — sets app.tenant_id = tenantAId
    const registerA = await client
      .post('/auth/register')
      .header('X-Tenant-ID', tenantAId)
      .json({
        email: 'isolation-test@example.com',
        password: 'SecurePass1',
        displayName: 'Tenant A User',
      })
    tokenA = registerA.body().token.value
    userAId = registerA.body().user.id
  })

  test('token from tenant A resolves to tenant A user', async ({ client, assert }) => {
    // Token A is valid — auth middleware verifies token, loads user (with tenantId = tenantAId).
    // TenantMiddleware reads auth.user.tenantId and sets app.tenant_id for RLS.
    const meResponse = await client
      .get('/users/me')
      .header('Authorization', `Bearer ${tokenA}`)

    meResponse.assertStatus(200)
    assert.equal(meResponse.body().user.id, userAId)
    assert.equal(meResponse.body().user.displayName, 'Tenant A User')
  })

  test('401 — request without token returns unauthorized', async ({ client }) => {
    // Protected route requires valid Bearer token
    const response = await client.get('/users/me')
    response.assertStatus(401)
  })
})
