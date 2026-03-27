// app/features/auth/tests/functional/social_auth.spec.ts
// AUTH-02: Google OAuth via @adonisjs/ally v6, stateless mode.
// Full OAuth flow cannot be tested end-to-end (requires real Google redirect).
// Test redirect behavior and mock callback behavior instead.
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { uuidv7 } from 'uuidv7'

test.group('Google OAuth', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  let tenantId: string

  group.each.setup(async () => {
    tenantId = uuidv7()
    await db
      .table('tenants')
      .insert({ id: tenantId, name: 'Test Tenant', slug: `tenant-${tenantId}` })
  })

  test('GET /auth/google/redirect returns redirect to Google', async ({ client }) => {
    // Redirect endpoint — requires X-Tenant-ID (publicTenant middleware)
    // Should return 302 to Google's OAuth authorization endpoint
    const response = await client
      .get('/auth/google/redirect')
      .header('X-Tenant-ID', tenantId)
      .redirects(0) // Don't follow redirects — we want to see the 302
    // Ally redirect returns 302 — ally constructs the Google OAuth URL and redirects
    response.assertStatus(302)
  })

  // Ally driver mock not available in Japa Phase 2 test setup — manual-only test.
  // D-09: new user with role citizen created when email not in tenant.
  // Manual verification via Postman OAuth2 flow (see docs/features/auth/VALIDATION.md).
  test('GET /auth/google/callback — new user created and token returned', async () => {
    // Placeholder — ally mock not available yet; see comment above
  }).skip(true)
})
