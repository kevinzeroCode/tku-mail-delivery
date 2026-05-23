export interface AdminAuthConfig {
  tenantId: string
  clientId: string
}

export type AdminAuthConfigStatus =
  | { ok: true }
  | { ok: false; error: 'missing_config' }

export function extractBearerToken(authorization: string | null): string | null {
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length).trim()
  return token ? token : null
}

export function validateAdminAuthConfig(config: AdminAuthConfig): AdminAuthConfigStatus {
  return config.tenantId && config.clientId
    ? { ok: true }
    : { ok: false, error: 'missing_config' }
}

export interface LocalAdminBypassConfig {
  nodeEnv: string | undefined
  enabled: string | undefined
  configuredEmail: string | undefined
  headerEmail: string | null
}

function normalizeBypassEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase() ?? ''
  return normalized.includes('@') ? normalized : null
}

export function localAdminBypassEmail(config: LocalAdminBypassConfig): string | null {
  if (config.nodeEnv !== 'development') return null
  if (config.enabled !== 'true') return null

  const configured = normalizeBypassEmail(config.configuredEmail)
  const header = normalizeBypassEmail(config.headerEmail)
  if (!configured || !header) return null

  return configured === header ? configured : null
}
