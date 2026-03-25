import { defineConfig, drivers } from '@adonisjs/queue'

const queueConfig = defineConfig({
  default: 'redis',

  adapters: {
    redis: drivers.redis(),
    sync: drivers.sync(),
  },
})

export default queueConfig
