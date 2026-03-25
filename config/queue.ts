// config/queue.ts
// INFRA-08: Background job queue configuration.
// Redis driver used in development and production.
// Sync driver used in tests (NODE_ENV=test) — no Redis dependency for unit tests.
// @adonisjs/queue v0.6.0 backed by @boringnode/queue (NOT BullMQ directly).
import { defineConfig, drivers } from '@adonisjs/queue'
import env from '#start/env'

// Named queues for specific job types (added in later phases):
//   notifications — push notification dispatch (RN-019)
//   ml_screening  — async ML image screening (RN-014)

const queueConfig = defineConfig({
  default: env.get('NODE_ENV') === 'test' ? 'sync' : 'redis',

  adapters: {
    redis: drivers.redis({ connectionName: 'main' }),
    sync: drivers.sync(),
  },
})

export default queueConfig
