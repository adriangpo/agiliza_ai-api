// app/features/auth/services/auth_service.ts
// AUTH-03: Token creation with per-role abilities.
// D-13 (CONTEXT.md): Citizens get ['reports:write', 'reports:read', 'flags:write', 'profile:manage']
// D-14 (CONTEXT.md): Managers get ['*'] (full access; Bouncer policies still enforce business rules)
import User from '#models/user'
import type { AccessToken } from '@adonisjs/auth/access_tokens'

export default class AuthService {
  /**
   * Create an access token with abilities based on the user's role.
   * AUTH-03: Opaque token issued by DbAccessTokensProvider.
   * D-13: citizen abilities; D-14: manager abilities.
   */
  async createToken(user: User): Promise<AccessToken> {
    const abilities =
      user.role === 'manager'
        ? ['*']
        : ['reports:write', 'reports:read', 'flags:write', 'profile:manage']

    return User.accessTokens.create(user, abilities)
  }
}
