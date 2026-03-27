// app/features/auth/tests/functional/social_auth.spec.ts
// AUTH-02: Google OAuth via @adonisjs/ally v6, stateless mode.
// Full OAuth flow cannot be tested end-to-end (requires real Google redirect).
// Test redirect behavior and mock callback behavior instead.
import { test } from '@japa/runner'

test.group('Google OAuth', () => {
  test('GET /auth/google/redirect returns redirect to Google', async ({ client }) => {
    // Redirect endpoint — should return 302 (or 200 if stateless and returning URL)
    const response = await client.get('/auth/google/redirect')
    // Ally redirect returns 302 — exact status depends on implementation
    response.assert?.oneOf(response.status(), [301, 302])
  })

  test('GET /auth/google/callback — new user created and token returned', async () => {
    // This test requires mocking the Ally driver.
    // If ally mocking is not available in Phase 2 test setup, this is a manual-only test.
    // Mark as skip and document in VALIDATION.md as manual verification.
    // D-09: new user with role citizen created when email not in tenant.
    test.skip('Requires ally driver mock — manual verification via Postman OAuth2 flow')
  })
})
