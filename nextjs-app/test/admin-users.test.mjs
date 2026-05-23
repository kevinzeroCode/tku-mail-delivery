import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeAdminEmail,
  extractAdminEmailFromClaims,
  bootstrapAdminEmailsFromEnv,
  isBootstrapAdminEmail,
  canDeleteAdminUser,
} from '../src/lib/admin-users.ts'

test('extracts admin email from preferred_username before other claims', () => {
  const email = extractAdminEmailFromClaims({
    preferred_username: '  Admin@TKU.edu.tw ',
    email: 'other@example.com',
    upn: 'upn@example.com',
  })

  assert.equal(email, 'admin@tku.edu.tw')
})

test('falls back to email then upn when preferred_username is missing', () => {
  assert.equal(
    extractAdminEmailFromClaims({ email: ' Person@Example.com ' }),
    'person@example.com'
  )
  assert.equal(
    extractAdminEmailFromClaims({ upn: ' Upn@Example.com ' }),
    'upn@example.com'
  )
})

test('rejects missing or invalid email claims', () => {
  assert.equal(extractAdminEmailFromClaims({ name: 'No Email' }), null)
  assert.equal(extractAdminEmailFromClaims({ preferred_username: 'not-an-email' }), null)
  assert.equal(normalizeAdminEmail(''), null)
})

test('parses bootstrap admin emails from env with normalization and dedupe', () => {
  const emails = bootstrapAdminEmailsFromEnv(' A@Example.com, bad, a@example.com, b@example.com ')

  assert.deepEqual(emails, ['a@example.com', 'b@example.com'])
})

test('detects and protects bootstrap admins from deletion', () => {
  const bootstrapEmails = ['root@example.com']

  assert.equal(isBootstrapAdminEmail(' ROOT@example.com ', bootstrapEmails), true)
  assert.equal(canDeleteAdminUser('root@example.com', bootstrapEmails), false)
  assert.equal(canDeleteAdminUser('manual@example.com', bootstrapEmails), true)
})
