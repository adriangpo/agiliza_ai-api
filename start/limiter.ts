// start/limiter.ts
// D-29: Rate limit key constants for @adonisjs/limiter v3 (Redis-backed).
//
// IMPORTANT: @adonisjs/limiter v3 does NOT support a named middleware pattern.
// Do NOT use named throttle middleware — that export does not exist in this version.
// Rate limiting is applied inline via the limiter service in feature middleware files.
// See app/shared/middleware/rate_limit_middleware.ts for the usage pattern.
//
// Add exported key constants here as each feature is implemented.
// Feature middleware files import these constants to ensure key consistency.
//
// Limits added in later phases:
//   Phase 3 — SUBMISSIONS_KEY = 'submissions'  (5 per 24h per user, RN-002)
//   Phase 5 — FLAGS_USER_KEY  = 'flags_user'   (per user per 1h, RN-015)
//   Phase 5 — FLAGS_IP_KEY    = 'flags_ip'     (per IP per 1h, RN-015)
//
// See: https://docs.adonisjs.com/guides/rate-limiting
export {}
// This file is intentionally empty in Phase 1.
// Add exported key constants here as each feature is implemented.
