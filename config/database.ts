import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  /**
   * Default connection used for all queries.
   */
  connection: env.get('DB_CONNECTION', 'pg'),

  connections: {
    /**
     * app role connection — used by all application queries (RLS-restricted).
     * INFRA-04: DML only (SELECT, INSERT, UPDATE, DELETE — no DDL).
     */
    pg: {
      client: 'pg',
      connection: {
        host: env.get('PG_HOST'),
        port: env.get('PG_PORT'),
        user: env.get('PG_USER'), // 'app' role — DML only
        password: env.get('PG_PASSWORD'),
        database: env.get('PG_DB_NAME'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      debug: app.inDev,
    },

    /**
     * migrator role connection — used only by node ace migration:run.
     * INFRA-04: DDL owner. Invoke via: DB_CONNECTION=pg_migrator node ace migration:run
     * (D-07: make migrate uses this connection via Makefile target)
     */
    pg_migrator: {
      client: 'pg',
      connection: {
        host: env.get('PG_HOST'),
        port: env.get('PG_PORT'),
        user: env.get('PG_MIGRATOR_USER'), // 'migrator' role — DDL
        password: env.get('PG_MIGRATOR_PASSWORD'),
        database: env.get('PG_DB_NAME'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default dbConfig
