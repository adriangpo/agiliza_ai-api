// app/features/auth/controllers/social_auth_controller.ts
// AUTH-02: Google OAuth via @adonisjs/ally v6, stateless mode.
// D-06 (CONTEXT.md): oauth_identities table stores provider links.
// D-08 (CONTEXT.md): auto-link if email already exists in tenant (no error).
// D-09 (CONTEXT.md): create new user (role: citizen) if email not in tenant.
// Stateless mode: mobile API clients cannot set cookies (no CSRF state).
import crypto from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import OAuthIdentity from '#models/oauth_identity'
import AuthService from '#features/auth/services/auth_service'

export default class SocialAuthController {
  async googleRedirect({ ally }: HttpContext) {
    // Stateless: disables CSRF state cookie — required for mobile API clients
    return ally.use('google').stateless().redirect()
  }

  async googleCallback({ ally, response, tenantId }: HttpContext) {
    const authService = new AuthService()
    const google = ally.use('google').stateless()

    // Handle OAuth error states
    if (google.accessDenied()) {
      return response.unauthorized({ message: 'Token inválido ou expirado.' })
    }
    if (google.stateMisMatch()) {
      return response.badRequest({ message: 'Token inválido ou expirado.' })
    }
    if (google.hasError()) {
      return response.badRequest({ message: 'Token inválido ou expirado.' })
    }

    const googleUser = await google.user()
    if (!googleUser.email) {
      return response.badRequest({ message: 'Token inválido ou expirado.' })
    }

    // D-08: If email exists in tenant → auto-link (firstOrCreate)
    // D-09: If email not found → create new user with OAuth-only credentials
    // tenantId is set on ctx by TenantMiddleware (or pre-auth tenant header middleware)
    const user = await User.firstOrCreate(
      { email: googleUser.email, tenantId },
      {
        email: googleUser.email,
        tenantId,
        displayName: googleUser.name ?? googleUser.nickName ?? 'User',
        // Unusable password — OAuth-only account cannot log in with password
        // crypto.randomUUID() produces a string that cannot be reproduced — effectively disables password auth
        password: crypto.randomUUID(),
        role: 'citizen' as const,
      }
    )

    // Create oauth_identities row if it doesn't exist yet (idempotent link)
    await OAuthIdentity.firstOrCreate(
      {
        tenantId,
        provider: 'google',
        providerUserId: googleUser.id,
      },
      {
        userId: user.id,
        tenantId,
        provider: 'google',
        providerUserId: googleUser.id,
        providerEmail: googleUser.email,
      }
    )

    const token = await authService.createToken(user)

    return response.ok({
      token: {
        type: 'bearer',
        value: token.value!.release(),
      },
      user: user.serialize(),
    })
  }
}
