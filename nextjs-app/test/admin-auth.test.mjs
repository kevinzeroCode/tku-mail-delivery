import test from 'node:test'
import assert from 'node:assert/strict'

import {
  extractBearerToken,
  localAdminBypassEmail,
  validateAdminAuthConfig,
} from '../src/lib/admin-auth-core.ts'

test('extracts bearer token from authorization header', () => {
  assert.equal(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi')
})

test('rejects missing or non-bearer authorization header', () => {
  assert.equal(extractBearerToken(null), null)
  assert.equal(extractBearerToken('Basic abc'), null)
  assert.equal(extractBearerToken('Bearer   '), null)
})

test('requires tenant and client id before verifying Microsoft tokens', () => {
  assert.deepEqual(
    validateAdminAuthConfig({ tenantId: '', clientId: 'client' }),
    { ok: false, error: 'missing_config' }
  )
  assert.deepEqual(
    validateAdminAuthConfig({ tenantId: 'tenant', clientId: '' }),
    { ok: false, error: 'missing_config' }
  )
  assert.deepEqual(
    validateAdminAuthConfig({ tenantId: 'tenant', clientId: 'client' }),
    { ok: true }
  )
})

test('local admin bypass only works in development when explicitly enabled', () => {
  assert.equal(
    localAdminBypassEmail({
      nodeEnv: 'production',
      enabled: 'true',
      configuredEmail: 'dev@example.com',
      headerEmail: 'dev@example.com',
    }),
    null
  )

  assert.equal(
    localAdminBypassEmail({
      nodeEnv: 'development',
      enabled: 'false',
      configuredEmail: 'dev@example.com',
      headerEmail: 'dev@example.com',
    }),
    null
  )

  assert.equal(
    localAdminBypassEmail({
      nodeEnv: 'development',
      enabled: 'true',
      configuredEmail: 'dev@example.com',
      headerEmail: 'other@example.com',
    }),
    null
  )

  assert.equal(
    localAdminBypassEmail({
      nodeEnv: 'development',
      enabled: 'true',
      configuredEmail: ' Dev@Example.com ',
      headerEmail: 'dev@example.com',
    }),
    'dev@example.com'
  )
})
