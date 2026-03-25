// database/migrations/000_foundation_extensions.ts
// INFRA-03: PostGIS extension. INFRA-05b: uuid-ossp for UUID generation.
// Runs as 'migrator' role (DDL owner).
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // PostGIS for geospatial queries (ST_DWithin, ST_MakePoint, etc.)
    await this.db.rawQuery('CREATE EXTENSION IF NOT EXISTS postgis')
    // uuid-ossp for gen_random_uuid() — used as fallback; app layer generates UUID v7
    await this.db.rawQuery('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
  }

  async down() {
    // Extensions are intentionally NOT dropped — they may be needed by other tables.
    // Dropping postgis in down() would cascade-drop all geography columns.
  }
}
