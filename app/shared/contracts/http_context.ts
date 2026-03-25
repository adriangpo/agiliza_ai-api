// Augments AdonisJS HttpContext with tenant-specific properties.
// D-10: TenantMiddleware sets these on each authenticated request.
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import '@adonisjs/core/http'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    tenantId: string
    db: TransactionClientContract
  }
}
