// app/features/auth/services/auth_service.ts
// AUTH-03: Token creation and credential verification for email/password auth.
// D-01 (CONTEXT.md): Opaque access tokens — no JWT.
// D-10a (CONTEXT.md): auth v10 uses tokensGuard + tokensUserProvider (no withAuthFinder mixin).
//   verifyCredentials is NOT available on User directly — manual lookup + hash.verify required.
// D-13 (CONTEXT.md): Citizen tokens issued with ['reports:write', 'reports:read', 'flags:write', 'profile:manage'].
// D-14 (CONTEXT.md): Manager tokens issued with ['*'] (full access).
import hash from '@adonisjs/core/services/hash'
import { Exception } from '@adonisjs/core/exceptions'
import User from '#models/user'
import type { AccessToken } from '@adonisjs/auth/access_tokens'

export default class AuthService {
  /**
   * Creates an opaque access token for the user.
   * Abilities are scoped by role (D-13, D-14).
   */
  async createToken(user: User): Promise<AccessToken> {
    const abilities: string[] =
      user.role === 'manager'
        ? ['*']
        : ['reports:write', 'reports:read', 'flags:write', 'profile:manage']

    return User.accessTokens.create(user, abilities)
  }

  /**
   * Verifies email/password credentials and returns the user.
   * D-10a: tokensUserProvider does not add verifyCredentials to User model.
   *   Manual lookup + hash.verify is required.
   * Returns user on success; throws Exception (status 401) on failure.
   * AUTH-01: Generic "invalid credentials" message — no user enumeration (D-19).
   */
  async verifyCredentials(email: string, password: string): Promise<User> {
    const user = await User.query().where('email', email).first()

    if (!user || !user.password || !(await hash.verify(user.password, password))) {
      throw new Exception('Invalid credentials', { status: 401 })
    }

    return user
  }
}
