// D-29: Rate limiting for this project uses @adonisjs/limiter v3.
//
// IMPORTANT: @adonisjs/limiter v3 does NOT export a standalone throttle_middleware.
// Named middleware patterns (throttle) documented in older guides do NOT work with this version.
// Do NOT add a 'throttle' key to router.named() in start/kernel.ts — there is no export to import.
//
// The correct pattern for v3 is the inline limiter service, called directly in a
// dedicated middleware class or inside the route handler:
//
//   import limiter from '@adonisjs/limiter/services/main'
//
//   // Inside a middleware handle() method:
//   await limiter
//     .use('redis', { requests: 5, duration: '24 hours' })
//     .attempt(`user:${ctx.auth.user!.id}:submissions`, () => next())
//
// Limit keys and thresholds are defined in start/limiter.ts as exported constants:
//   Phase 3: submissions — 5 per 24h per user (RN-002)
//   Phase 5: flags_user — per user per 1h (RN-015); flags_ip — per IP per 1h (RN-015)
//
// Each feature that needs rate limiting creates its OWN middleware file in
// app/features/{name}/middleware/ that imports the limiter service and applies
// the limit for that feature. This file documents the pattern; it is not a base class.
//
// See: https://docs.adonisjs.com/guides/rate-limiting
export {}
