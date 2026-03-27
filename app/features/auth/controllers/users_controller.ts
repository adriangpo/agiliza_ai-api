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

  async deleteMe({ auth, response, db }: HttpContext) {
    const accountService = new AccountService()
    // D-Rule-1: Pass ctx.db (tenant-scoped transaction handle from TenantMiddleware) to
    // AccountService so it uses the same transaction rather than opening a new db.transaction().
    // Using ctx.db prevents nested transaction conflicts with withGlobalTransaction() in tests.
    await accountService.deleteAccount(auth.user!, db)
    // AUTH-07: 204 — no response body
    return response.noContent()
  }
}
