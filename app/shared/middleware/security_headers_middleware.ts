// D-23: HTTP security headers — strict from day one.
// Runs as server middleware (applies to ALL requests including 404s).
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class SecurityHeadersMiddleware {
  async handle({ response }: HttpContext, next: NextFn) {
    // HSTS: force HTTPS for 1 year, including subdomains
    response.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

    // CSP: restrictive default — no inline scripts, no external resources
    response.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'"
    )

    // Prevent embedding in frames (clickjacking protection)
    response.header('X-Frame-Options', 'DENY')

    // Prevent MIME type sniffing
    response.header('X-Content-Type-Options', 'nosniff')

    // Limit referrer information leakage
    response.header('Referrer-Policy', 'strict-origin-when-cross-origin')

    // Restrict browser features
    response.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

    await next()
  }
}
