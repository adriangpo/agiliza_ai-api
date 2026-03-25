// D-29: Reusable rate limiting middleware backed by Redis via @adonisjs/limiter.
// This is the base class/type reference. Actual rate limits are configured per-route
// using the @adonisjs/limiter throttle middleware in start/limiter.ts.
// See start/kernel.ts — 'throttle' named middleware registered there.
//
// Usage in route files (Phase 3+):
//   import { middleware } from '#start/kernel'
//   router.post('/reports', handler).use(middleware.throttle('submissions'))
//
// Limit definitions go in start/limiter.ts (created in Plan 01-07).
export {}
// This file is intentionally minimal — it documents the usage pattern.
// The actual throttle middleware is provided by @adonisjs/limiter.
