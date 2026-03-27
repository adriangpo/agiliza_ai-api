// app/features/auth/controllers/users_controller.ts
// AUTH-06: GET /users/me — public profile (id, displayName, joinedAt only).
// AUTH-07, AUTH-08: DELETE /users/me — account deletion with PII anonymization.
// UI-SPEC: wrapped in { user: ... } envelope per response shape convention.
import type { HttpContext } from '@adonisjs/core/http'
import AccountService from '#features/auth/services/account_service'

export default class UsersController {
  async me({ auth, response }: HttpContext) {
    // auth middleware ensures user is authenticated before reaching here
    // user.serialize() returns { id, displayName, joinedAt } — see User model serializeAs config
    return response.ok({ user: auth.user!.serialize() })
  }

  async deleteMe({ auth, response }: HttpContext) {
    const accountService = new AccountService()
    await accountService.deleteAccount(auth.user!)
    // AUTH-07: 204 — no response body
    return response.noContent()
  }
}
