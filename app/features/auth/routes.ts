// app/features/auth/routes.ts
// AUTH-01 through AUTH-08: All auth and user profile route definitions.
// D-01: Feature routes are self-contained in feature folder.
// MIDDLEWARE ORDERING IS CRITICAL:
//   - Public routes (register, login): publicTenant middleware reads X-Tenant-ID header
//   - Authenticated routes (logout, /users/me): auth guard first, then tenant (reads from auth.user)
//   - OAuth routes: no tenant middleware — provider callback handles tenant context via X-Tenant-ID
//     (ally stateless mode: no session/cookie; tenant context not available until after OAuth resolution)
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#features/auth/controllers/auth_controller')
const SocialAuthController = () => import('#features/auth/controllers/social_auth_controller')
const UsersController = () => import('#features/auth/controllers/users_controller')

// ── Public auth routes (no token required, tenant from X-Tenant-ID header) ─────
router
  .group(() => {
    // AUTH-01: Register citizen account — email/password
    router.post('/auth/register', [AuthController, 'register'])
    // AUTH-03: Login with email/password — returns opaque access token
    router.post('/auth/login', [AuthController, 'login'])
  })
  .use(middleware.publicTenant())

// ── Google OAuth routes (stateless — no session cookie, no CSRF state) ─────────
// AUTH-02: Google OAuth flow. Tenant context comes from X-Tenant-ID header in the
// redirect request (client must include it). The callback resolves tenant via publicTenant.
router
  .group(() => {
    router.get('/auth/google/redirect', [SocialAuthController, 'googleRedirect'])
    router.get('/auth/google/callback', [SocialAuthController, 'googleCallback'])
  })
  .use(middleware.publicTenant())

// ── Authenticated routes (valid Bearer token required) ───────────────────────────
// Middleware ordering: auth MUST run first (validates token, loads user),
// then tenant (reads tenantId from auth.user.tenantId, sets app.tenant_id for RLS).
router
  .group(() => {
    // AUTH-05: Logout — delete current token (instant revocation)
    router.post('/auth/logout', [AuthController, 'logout'])
    // AUTH-06: Public profile — id, displayName, joinedAt only (no email, no role)
    router.get('/users/me', [UsersController, 'me'])
    // AUTH-07, AUTH-08: Delete account — PII anonymized, all tokens invalidated
    router.delete('/users/me', [UsersController, 'deleteMe'])
  })
  .use(middleware.auth({ guards: ['api'] }))
  .use(middleware.tenant())
