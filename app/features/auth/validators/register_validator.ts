// app/features/auth/validators/register_validator.ts
// AUTH-01: VineJS registration validator.
// D-16 (CONTEXT.md): password min 8 chars; UI-SPEC allows length-only rule (no complexity requirement in v1).
// D-25: Column limits enforced here AND at DB level (email 254, display_name 100).
// D-26: .escape() on displayName rejects HTML/script (XSS prevention).
// UI-SPEC validation table: password max 72 chars (bcrypt hard limit).
import vine from '@vinejs/vine'

export const registerValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail().maxLength(254),
    password: vine.string().minLength(8).maxLength(72),
    displayName: vine.string().trim().minLength(2).maxLength(100).escape(), // D-26: XSS rejection — rejects HTML/script content
  })
)
