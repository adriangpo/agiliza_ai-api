// database/migrations/004_auth_oauth_identities.ts
// AUTH-02: OAuth identity linking table.
// D-06 (CONTEXT.md): provider stored as VARCHAR(20) string (not DB enum) for extensibility.
//   Current value: 'google'. Future: 'apple', 'facebook' — no schema change needed.
// D-07: Apple OAuth deferred (see CONTEXT.md D-07 decision).
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'oauth_identities'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      // bigInteger FK — users.id is bigIncrements (bigint)
      table
        .bigInteger('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      // VARCHAR string (not DB enum) — extensible for future providers without migration
      table.string('provider', 20).notNullable()
      table.string('provider_user_id', 255).notNullable()
      table.string('provider_email', 254).nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // One identity per (tenant, provider, provider_user_id) — prevents duplicate links
      table.unique(['tenant_id', 'provider', 'provider_user_id'])
      // Fast lookup by user when listing linked identities
      table.index(['user_id'])
      table.index(['tenant_id'])
    })

    this.schema.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_identities TO app`)
    this.schema.raw(`GRANT USAGE, SELECT ON SEQUENCE oauth_identities_id_seq TO app`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
