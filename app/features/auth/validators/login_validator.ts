// app/features/auth/validators/login_validator.ts
// AUTH-01: VineJS login validator.
// Minimal validation — credential verification is done by User.verifyCredentials.
// No password complexity rules here — don't reveal what the rules are via error messages.
import vine from '@vinejs/vine'

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().normalizeEmail(),
    password: vine.string().minLength(1).maxLength(128),
  })
)
