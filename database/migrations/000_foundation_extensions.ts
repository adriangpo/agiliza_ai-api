// database/migrations/000_foundation_extensions.ts
// INFRA-03: PostGIS extension. INFRA-05b: uuid-ossp for UUID generation.
// Runs as 'migrator' role (DDL owner).
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  static disableTransactions = true

  async up() {
    // disableTransactions = true: CREATE EXTENSION cannot run in a transaction block in PostgreSQL.
    // Lucid runs migrations in transactions by default; disabling transactions for this migration
    // prevents "cannot run inside a transaction block" errors.
    //
    // PostGIS for geospatial queries (ST_DWithin, ST_MakePoint, etc.)
    // Silently skip if PostGIS is not installed (e.g., local dev without Docker).
    // CI and production always use postgis/postgis Docker image which has it pre-installed.
    try {
      await this.db.rawQuery('CREATE EXTENSION IF NOT EXISTS postgis')
    } catch {
      // PostGIS not available — skip silently. Geospatial features will fail at runtime
      // until PostGIS is installed (use `make up` for Docker environment with PostGIS).
    }
    // uuid-ossp for gen_random_uuid() — used as fallback; app layer generates UUID v7
    try {
      await this.db.rawQuery('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    } catch {
      // uuid-ossp not available — skip silently.
    }
  }

  async down() {
    // Extensions are intentionally NOT dropped — they may be needed by other tables.
    // Dropping postgis in down() would cascade-drop all geography columns.
  }
}
