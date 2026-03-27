// database/migrations/002_auth_users.ts
// AUTH-01, AUTH-03: users table — tenant-scoped, RLS-enforced.
// D-09: bigint serial id; uuid tenant_id FK → tenants.id.
// D-08: FORCE ROW LEVEL SECURITY applied; policy uses current_setting('app.tenant_id').
// D-25: Column sizes match VineJS validator limits (email 254, display_name 100).
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id').primary()
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE')
      table.string('email', 254).notNullable()
      table.string('password', 255).nullable()
      table.string('display_name', 100).notNullable()
      table.enum('role', ['citizen', 'manager']).notNullable().defaultTo('citizen')
      table.timestamp('deleted_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // AUTH-01: email unique per tenant — NOT globally unique
      table.unique(['tenant_id', 'email'])
      table.index(['tenant_id'])
    })

    // D-08, D-11: Row Level Security — policy uses TenantMiddleware's set_config value
    this.schema.raw(`ALTER TABLE users ENABLE ROW LEVEL SECURITY`)
    this.schema.raw(`ALTER TABLE users FORCE ROW LEVEL SECURITY`)
    this.schema.raw(`
      CREATE POLICY users_tenant_isolation ON users
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `)

    // D-07: app role gets DML only — no DDL
    this.schema.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON users TO app`)
    this.schema.raw(`GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO app`)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
