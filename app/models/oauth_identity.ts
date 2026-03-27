// app/models/oauth_identity.ts
// AUTH-02: OAuth identity linking table model.
// D-06 (CONTEXT.md): provider is a string (not enum type) to support future providers
//   without schema changes. Current value: 'google'.
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class OAuthIdentity extends BaseModel {
  static table = 'oauth_identities'

  @column({ isPrimary: true })
  declare id: number

  // bigint FK → users.id (matches bigInteger in migration)
  @column()
  declare userId: number

  @column({ serializeAs: null })
  declare tenantId: string

  // String (not TypeScript enum) — extensible for future providers
  @column()
  declare provider: string

  @column()
  declare providerUserId: string

  @column()
  declare providerEmail: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
