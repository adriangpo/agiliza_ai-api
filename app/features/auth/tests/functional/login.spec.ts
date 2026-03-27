// app/features/auth/tests/functional/login.spec.ts
// AUTH-01, AUTH-03: Login — returns opaque token on valid credentials.
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

test.group('POST /auth/login', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  group.each.setup(async ({ context: { client } }) => {
    // Pre-register a user for login tests
    await client.post('/auth/register').json({
      email: 'login-test@example.com',
      password: 'SecurePass1',
      displayName: 'Login Test User',
    })
  })

  test('200 — valid credentials return token', async ({ client, assert }) => {
    const response = await client.post('/auth/login').json({
      email: 'login-test@example.com',
      password: 'SecurePass1',
    })

    response.assertStatus(200)
    const body = response.body()
    assert.isTrue(body.token.value.startsWith('oat_'))
    assert.equal(body.token.type, 'bearer')
    assert.notProperty(body.user, 'email')
  })

  test('401 — wrong password returns generic error (no user enumeration)', async ({ client }) => {
    const response = await client.post('/auth/login').json({
      email: 'login-test@example.com',
      password: 'WrongPassword1',
    })

    response.assertStatus(401)
    response.assertBodyContains({
      message: 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.',
    })
  })

  test('401 — unknown email returns same generic error', async ({ client }) => {
    const response = await client.post('/auth/login').json({
      email: 'notexist@example.com',
      password: 'SecurePass1',
    })

    response.assertStatus(401)
    response.assertBodyContains({
      message: 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.',
    })
  })
})
