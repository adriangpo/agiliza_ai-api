// config/ally.ts
// AUTH-02: Google OAuth via @adonisjs/ally v6.
// D-07: Apple OAuth deferred — no reliable @adonisjs/ally v6 Apple driver (v2 item).
import { defineConfig, services } from '@adonisjs/ally'
import type { InferSocialProviders } from '@adonisjs/ally/types'
import env from '#start/env'

const allyConfig = defineConfig({
  google: services.google({
    clientId: env.get('GOOGLE_CLIENT_ID'),
    clientSecret: env.get('GOOGLE_CLIENT_SECRET'),
    callbackUrl: env.get('GOOGLE_CALLBACK_URL'),
  }),
})

export default allyConfig

declare module '@adonisjs/ally/types' {
  interface SocialProviders extends InferSocialProviders<typeof allyConfig> {}
}
