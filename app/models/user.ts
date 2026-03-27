// app/models/user.ts
// AUTH-01, AUTH-03: User Lucid model — central model for all auth operations.
// D-10a: Uses DbAccessTokensProvider (opaque access tokens, DB-backed). No JWT.
// D-09: bigint serial id; uuid tenant_id FK.
// AUTH-06: Public profile serializes id, displayName, joinedAt only.
//   email, password, role, tenantId, deletedAt are all excluded via serializeAs: null.
// withAuthFinder: provides User.verifyCredentials(email, password) for login (AUTH-01).
import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import hash from '@adonisjs/core/services/hash'
import OAuthIdentity from '#models/oauth_identity'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends AuthFinder(BaseModel) {
  // AUTH-03: Opaque access tokens config.
  // D-01 (CONTEXT.md): expiresIn 90 days — long-lived, instantly revocable from DB.
  // UI-SPEC: prefix 'oat_' — token.value always starts with 'oat_'.
  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '90 days',
    prefix: 'oat_',
    table: 'auth_access_tokens',
    type: 'auth_token',
    tokenSecretLength: 40,
  })

  // D-09: bigint serial — matches bigIncrements in migration
  @column({ isPrimary: true })
  declare id: number

  // D-09: uuid FK → tenants.id — excluded from public responses
  @column({ serializeAs: null })
  declare tenantId: string

  // AUTH-06: email NOT in public profile — serializeAs: null
  @column({ serializeAs: null })
  declare email: string

  // bcrypt hash — MUST NEVER appear in any response
  @column({ serializeAs: null })
  declare password: string | null

  // Public-safe display name (AUTH-06)
  @column()
  declare displayName: string

  // D-10: 'citizen' | 'manager' — internal only, not in public response
  @column({ serializeAs: null })
  declare role: 'citizen' | 'manager'

  // Soft-delete tombstone — internal only
  @column({ serializeAs: null })
  declare deletedAt: DateTime | null

  // UI-SPEC: response key is 'joinedAt', not 'createdAt'
  @column.dateTime({ autoCreate: true, serializeAs: 'joinedAt' })
  declare createdAt: DateTime

  // Internal — not in public response
  @column.dateTime({ autoCreate: true, autoUpdate: true, serializeAs: null })
  declare updatedAt: DateTime

  @hasMany(() => OAuthIdentity)
  declare oauthIdentities: HasMany<typeof OAuthIdentity>
  // Note: password hashing before save is handled by the withAuthFinder mixin (hashPassword hook).
  // The mixin's @beforeSave hook calls hash.make() for any dirty password field.
  // Do NOT add a second @beforeSave hash hook here — it would double-hash the password.
}
