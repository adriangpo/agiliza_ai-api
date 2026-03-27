// AdonisJS v7 three-stack middleware pattern.
// Stack 1 (server): runs for ALL requests including 404s
// Stack 2 (router): runs only when a route matches
// Stack 3 (named): applied explicitly per route or group
import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/**
 * The error handler is used to convert an exception
 * to a HTTP response.
 */
server.errorHandler(() => import('#exceptions/handler'))

/**
 * Server middleware — runs for ALL requests, including unmatched routes (404s).
 * CORS must run here to handle preflight requests before routing.
 * Security headers must run here to apply to all responses (D-23).
 */
server.use([
  () => import('#middleware/force_json_response_middleware'),
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
  () => import('#shared/middleware/security_headers_middleware'),
])

/**
 * Router middleware — runs only when a route matches.
 * Body parsing only needed when a route exists.
 */
router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
  () => import('#middleware/initialize_bouncer_middleware'),
])

/**
 * Named middleware — applied explicitly per route group.
 * ORDERING IS CRITICAL: auth MUST be applied before tenant.
 * TenantMiddleware reads from ctx.auth.user — auth guard must have already run.
 *
 * Usage in route files:
 *   router.group(() => { ... })
 *     .use(middleware.auth({ guards: ['api'] }))
 *     .use(middleware.tenant())
 */
export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
  tenant: () => import('#shared/middleware/tenant_middleware'),
  // publicTenant: reads X-Tenant-ID header for public routes (register, login) that have no auth token.
  // Use on routes that need tenant context but do not require authentication.
  publicTenant: () => import('#shared/middleware/public_tenant_middleware'),
  // throttle: @adonisjs/limiter v3 does not ship a standalone throttle_middleware export.
  // Rate limiting in this version is applied inline in route handlers via the limiter service.
  // See app/shared/middleware/rate_limit_middleware.ts for the usage pattern documentation.
  // Per-route throttling is configured in start/limiter.ts (Plan 01-07).
})
