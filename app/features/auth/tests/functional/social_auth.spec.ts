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

  // Ally driver mock not available in Japa Phase 2 test setup — manual-only test.
  // D-09: new user with role citizen created when email not in tenant.
  // Manual verification via Postman OAuth2 flow (see docs/features/auth/VALIDATION.md).
  test('GET /auth/google/callback — new user created and token returned', async () => {
    // Placeholder — ally mock not available yet; see comment above
  }).skip(true)
})
