// start/limiter.ts
// D-29: Rate limiting configurations. Redis-backed via @adonisjs/limiter.
// Each feature defines its own throttle key here.
// Usage in route files:
//   router.post('/reports').use(middleware.throttle('submissions'))
//
// Limits added in later phases:
//   Phase 3: 'submissions' — 5 per 24h per user (RN-002)
//   Phase 5: 'flags_user' — per user; 'flags_ip' — per IP (RN-015)
//   Phase *: 'global' — configurable global limit
//
// See: https://docs.adonisjs.com/guides/rate-limiting
export {}
// This file is intentionally empty in Phase 1.
// Add throttle definitions here as each feature is implemented.
