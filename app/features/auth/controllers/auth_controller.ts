// app/features/auth/controllers/auth_controller.ts
// AUTH-01, AUTH-03, AUTH-05: Register, login, logout endpoints.
// D-10a: Opaque tokens only — no JWT, no refresh tokens.
// D-19: Two-tier error handling — VineJS 422 or generic message 401/409.
// D-21: Error messages in Portuguese (pt-BR) per UI-SPEC Copywriting Contract.
// Tenant context source:
//   - register/login (public routes): PublicTenantMiddleware reads X-Tenant-ID header → ctx.tenantId
//   - logout (authenticated): TenantMiddleware reads auth.user.tenantId → ctx.tenantId
import type { HttpContext } from '@adonisjs/core/http'
import { errors as authErrors } from '@adonisjs/auth'
import User from '#models/user'
import AuthService from '#features/auth/services/auth_service'
import { registerValidator } from '#features/auth/validators/register_validator'
import { loginValidator } from '#features/auth/validators/login_validator'

export default class AuthController {
  async register({ request, response, tenantId }: HttpContext) {
    const authService = new AuthService()
    const data = await request.validateUsing(registerValidator)

    // tenantId is set by PublicTenantMiddleware (reads X-Tenant-ID header).
    // RLS policy on users table enforces that any INSERT uses the same tenantId
    // as app.tenant_id set in the DB session (set by PublicTenantMiddleware).
    try {
      const user = await User.create({
        tenantId,
        email: data.email,
        password: data.password,
        displayName: data.displayName,
        role: 'citizen',
      })

      const token = await authService.createToken(user)

      return response.created({
        token: {
          type: 'bearer',
          value: token.value!.release(),
        },
        user: user.serialize(),
      })
    } catch (error) {
      // PostgreSQL unique constraint violation on (tenant_id, email)
      // Error code 23505 = unique_violation in pg
      if (
        (error as NodeJS.ErrnoException).code === '23505' ||
        String((error as { constraint?: string }).constraint ?? '').includes('email')
      ) {
        return response.conflict({
          message: 'Este e-mail já está registrado neste município.',
        })
      }
      throw error
    }
  }

  async login({ request, response }: HttpContext) {
    const authService = new AuthService()
    const { email, password } = await request.validateUsing(loginValidator)

    try {
      // User.verifyCredentials looks up user by email and verifies password hash.
      // PublicTenantMiddleware has already set app.tenant_id in the DB session,
      // so RLS ensures lookup is scoped to the current tenant automatically.
      // Throws E_INVALID_CREDENTIALS on failure.
      const user = await User.verifyCredentials(email, password)

      const token = await authService.createToken(user)

      return response.ok({
        token: {
          type: 'bearer',
          value: token.value!.release(),
        },
        user: user.serialize(),
      })
    } catch (error) {
      if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
        // AUTH-03, D-19: Generic message — no user enumeration.
        // UI-SPEC Copywriting Contract: exact pt-BR message required.
        return response.unauthorized({
          message: 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.',
        })
      }
      throw error
    }
  }

  async logout({ auth, response }: HttpContext) {
    // AUTH-05: Delete CURRENT token from auth_access_tokens.
    // D-03 (CONTEXT.md): POST /auth/logout deletes current token only.
    // TenantMiddleware has already run before this handler (via auth → tenant middleware order).
    await auth.use('api').invalidateToken()
    return response.noContent()
  }
}
