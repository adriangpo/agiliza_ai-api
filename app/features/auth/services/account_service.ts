// app/features/auth/services/account_service.ts
// AUTH-07, AUTH-08: Account deletion — PII anonymization + token invalidation.
// D-17 (CONTEXT.md): Exact overwrite values.
// D-18 (CONTEXT.md): Row kept as tombstone (FK integrity for publications, audit logs).
// RN-005: displayName MUST be exactly 'Cidadão Anônimo' — no ASCII normalization.
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import OAuthIdentity from '#models/oauth_identity'

export default class AccountService {
  async deleteAccount(user: User): Promise<void> {
    // AUTH-08: Invalidate all tokens FIRST (before anonymizing email/password)
    // so no token can be used while the transaction is in progress.
    const tokens = await User.accessTokens.all(user)
    for (const token of tokens) {
      await User.accessTokens.delete(user, token.identifier)
    }

    await db.transaction(async (trx) => {
      // D-17, Step 5: Hard-delete all OAuth identities for this user
      await OAuthIdentity.query({ client: trx }).where('userId', user.id).delete()

      // D-17, Steps 1-4: Overwrite PII (soft delete — keep row for FK integrity)
      // D-18: The row is a tombstone — never truly deleted.
      // RN-005: 'Cidadão Anônimo' is a locked business requirement — exact string.
      await user
        .useTransaction(trx)
        .merge({
          email: `deleted-${user.id}@anonymized.invalid`,
          displayName: 'Cidadão Anônimo',
          password: null,
          deletedAt: DateTime.now(),
        })
        .save()
    })
  }
}
