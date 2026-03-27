// app/features/auth/tests/functional/logout.spec.ts
// AUTH-05: Logout — deletes current token from auth_access_tokens immediately.
// D-03 (CONTEXT.md): POST /auth/logout deletes current token only.
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('POST /auth/logout', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  let authToken: string

  group.each.setup(async ({ context: { client } }) => {
    const registerResponse = await client.post('/auth/register').json({
      email: 'logout-test@example.com',
      password: 'SecurePass1',
      displayName: 'Logout Test User',
    })
    authToken = registerResponse.body().token.value
  })

  test('204 — logout deletes current token', async ({ client }) => {
    const response = await client
      .post('/auth/logout')
      .header('Authorization', `Bearer ${authToken}`)

    response.assertStatus(204)
  })

  test('401 — replaying same token after logout', async ({ client }) => {
    // First logout
    await client.post('/auth/logout').header('Authorization', `Bearer ${authToken}`)

    // Replay with the now-deleted token
    const response = await client
      .post('/auth/logout')
      .header('Authorization', `Bearer ${authToken}`)

    response.assertStatus(401)
  })

  test('401 — logout without Authorization header', async ({ client }) => {
    const response = await client.post('/auth/logout')
    response.assertStatus(401)
  })
})
