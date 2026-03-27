// app/shared/middleware/public_tenant_middleware.ts
// AUTH-01: Tenant context for PUBLIC routes (register, login) where no auth token exists.
// Reads tenant_id from X-Tenant-ID request header, validates it exists in the tenants table,
// then sets app.tenant_id via set_config (same pattern as TenantMiddleware but header-sourced).
//
// CRITICAL ORDERING: PublicTenantMiddleware is for routes WITHOUT auth middleware.
//   - Public routes:        PublicTenantMiddleware → controller
//   - Authenticated routes: auth middleware → TenantMiddleware (reads from auth.user) → controller
//
// The X-Tenant-ID header must contain a valid UUID v7 for a tenant that exists in the tenants table.
// Returns 400 if the header is missing and 404 if the tenant is not found.
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'

export default class PublicTenantMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const tenantId = ctx.request.header('X-Tenant-ID')

    if (!tenantId) {
      return ctx.response.badRequest({
        message: 'X-Tenant-ID header is required.',
      })
    }

    // Verify the tenant exists (tenants table has no RLS — any DB role can query it)
    const tenant = await db.from('tenants').where('id', tenantId).select('id').first()

    if (!tenant) {
      return ctx.response.notFound({
        message: 'Tenant not found.',
      })
    }

    await db.transaction(async (trx) => {
      // set_config with is_local=true — transaction-scoped (same pattern as TenantMiddleware)
      await trx.rawQuery(`SELECT set_config('app.tenant_id', ?, ?)`, [tenantId, 'true'])

      // Attach to HTTP context for downstream controller use
      ctx.tenantId = tenantId
      ctx.db = trx

      await next()
    })
  }
}
