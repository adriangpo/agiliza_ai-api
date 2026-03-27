// INFRA-06: D-10 — TenantMiddleware sets app.tenant_id via set_config with is_local=true.
// CRITICAL: Must use is_local=true (transaction-scoped) — session-scoped SET leaks across pooled connections.
// CRITICAL: Must wrap in db.transaction() — set_config with is_local=true only takes effect inside a transaction.
// CRITICAL: next() must be called INSIDE the transaction, not after it — the transaction must cover the entire request.
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import db from '@adonisjs/lucid/services/db'

export default class TenantMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    // auth middleware MUST have run and populated ctx.auth.user before this middleware.
    // See start/kernel.ts: auth guard applied before tenant in route groups.
    // User.tenantId is added by the Phase 2 migration — cast via unknown is safe here because
    // TenantMiddleware is only wired to routes that require auth (see start/kernel.ts named middleware).

    const user = ctx.auth.user! as any
    const tenantId = user.tenantId as string

    await db.transaction(async (trx) => {
      // set_config(name, value, is_local):
      //   is_local = true → transaction-scoped (SET LOCAL equivalent)
      //   Resets to NULL when transaction ends — safe with connection pooling.
      //   is_local = false → session-scoped (leaks to next request on same connection — FORBIDDEN)
      await trx.rawQuery(`SELECT set_config('app.tenant_id', ?, ?)`, [tenantId, 'true'])

      // Attach tenant context to HTTP context for downstream use
      ctx.tenantId = tenantId
      // Attach the transaction handle — services MUST use this trx, NOT the global db import
      // Using global db would bypass RLS (no app.tenant_id set on that connection)
      ctx.db = trx

      await next()
    })
  }
}
