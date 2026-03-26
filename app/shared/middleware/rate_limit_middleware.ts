// D-29: Reusable rate limiting documentation for @adonisjs/limiter v3.
// @adonisjs/limiter v3 does NOT provide a standalone throttle_middleware export.
// Rate limiting is applied inline per route handler using the limiter service.
//
// Usage pattern (Phase 3+):
//   import limiter from '@adonisjs/limiter/services/main'
//
//   router.post('/reports', async ({ request, response }) => {
//     const key = `user:${ctx.auth.user!.id}:submissions`
//     const limit = limiter.use({ requests: 5, duration: '24 hours' })
//     await limit.attempt(key, () => { /* handler logic */ })
//   })
//
// Limit definitions and keys go in start/limiter.ts (created in Plan 01-07).
// See: https://docs.adonisjs.com/guides/rate-limiting
export {}
// This file is intentionally minimal — it documents the correct usage pattern.
// The limiter service is provided by @adonisjs/limiter.
