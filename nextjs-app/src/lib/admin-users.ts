const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeAdminEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(normalized)) return null
  return normalized
}

export function extractAdminEmailFromClaims(claims: Record<string, unknown>): string | null {
  return (
    normalizeAdminEmail(claims.preferred_username) ??
    normalizeAdminEmail(claims.email) ??
    normalizeAdminEmail(claims.upn)
  )
}

export function bootstrapAdminEmailsFromEnv(raw: string | undefined): string[] {
  const emails = (raw ?? '')
    .split(',')
    .map(email => normalizeAdminEmail(email))
    .filter((email): email is string => Boolean(email))
  return Array.from(new Set(emails))
}

export function bootstrapAdminEmails(): string[] {
  return bootstrapAdminEmailsFromEnv(process.env.ADMIN_BOOTSTRAP_EMAILS)
}

export function isBootstrapAdminEmail(email: unknown, bootstrapEmails = bootstrapAdminEmails()): boolean {
  const normalized = normalizeAdminEmail(email)
  return !!normalized && bootstrapEmails.includes(normalized)
}

export function canDeleteAdminUser(email: unknown, bootstrapEmails = bootstrapAdminEmails()): boolean {
  return !isBootstrapAdminEmail(email, bootstrapEmails)
}
