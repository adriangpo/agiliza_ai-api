// app/features/auth/policies/user_policy.ts
// D-12 (CONTEXT.md): Bouncer policies are the single authorization mechanism.
// UserPolicy governs account-level operations.
import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'
import type User from '#models/user'

export default class UserPolicy extends BasePolicy {
  /**
   * AUTH-07: User can only delete their own account.
   * Prevents crafted requests from deleting another user's account
   * even if both users are in the same tenant.
   */
  deleteAccount(currentUser: User, targetUser: User): AuthorizerResponse {
    return currentUser.id === targetUser.id
  }
}
