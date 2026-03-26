// start/limiter.ts
// D-29: Rate limiting configurations. Redis-backed via @adonisjs/limiter v3.
// @adonisjs/limiter v3 does NOT use middleware.throttle(...).
// Each feature applies limits inline using the limiter service (see rate_limit_middleware.ts).
//
// Limits to add in later phases:
//   Phase 3: 'submissions' — 5 per 24h per user (RN-002)
//   Phase 5: 'flags_user' — per user (RN-015); 'flags_ip' — per IP (RN-015)
//   Phase *: 'global' — configurable global limit
//
// See: https://docs.adonisjs.com/guides/rate-limiting
export {}
// This file is intentionally empty in Phase 1.
// Add limit configurations here as each feature is implemented.
