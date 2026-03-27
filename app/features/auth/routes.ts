// app/features/auth/routes.ts
// AUTH-01, AUTH-03, AUTH-05: Register, login, logout route definitions.
// D-01: Feature routes are self-contained in feature folder.
// MIDDLEWARE ORDERING IS CRITICAL:
//   - Public routes (register, login): publicTenant middleware reads X-Tenant-ID header
//   - Authenticated routes (logout): auth guard first, then tenant (reads from auth.user)
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#features/auth/controllers/auth_controller')

// Public auth routes — require X-Tenant-ID header but no auth token
router
  .group(() => {
    router.post('/auth/register', [AuthController, 'register'])
    router.post('/auth/login', [AuthController, 'login'])
  })
  .use(middleware.publicTenant())

// Authenticated auth routes — require valid Bearer token
router
  .group(() => {
    router.post('/auth/logout', [AuthController, 'logout'])
  })
  .use(middleware.auth({ guards: ['api'] }))
  .use(middleware.tenant())
