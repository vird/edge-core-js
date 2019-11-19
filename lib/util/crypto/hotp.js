// 

import hashjs from 'hash.js'
import { base32 } from 'rfc4648'

export function numberToBe64(number) {
  const high = Math.floor(number / 4294967296)
  return new Uint8Array([
    (high >> 24) & 0xff,
    (high >> 16) & 0xff,
    (high >> 8) & 0xff,
    high & 0xff,
    (number >> 24) & 0xff,
    (number >> 16) & 0xff,
    (number >> 8) & 0xff,
    number & 0xff
  ])
}

export function hmacSha1(data, key) {
  const hmac = hashjs.hmac(hashjs.sha1, key)
  return hmac.update(data).digest()
}

/**
 * Implements the rfc4226 HOTP specification.
 * @param {*} secret The secret value, K, from rfc4226
 * @param {*} counter The counter, C, from rfc4226
 * @param {*} digits The number of digits to generate
 */
export function hotp(secret, counter, digits) {
  const hmac = hmacSha1(numberToBe64(counter), secret)

  const offset = hmac[19] & 0xf
  const p =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3]
  const text = p.toString()

  const padding = Array(digits).join('0')
  return (padding + text).slice(-digits)
}

export function totp(
  secret,
  now = Date.now() / 1000
) {
  if (secret == null) return
  return hotp(base32.parse(secret, { loose: true }), now / 30, 6)
}

export function checkTotp(secret, otp) {
  const now = Date.now() / 1000
  return (
    otp === totp(secret, now - 1) ||
    otp === totp(secret, now) ||
    otp === totp(secret, now + 1)
  )
}

export function fixOtpKey(secret) {
  return base32.stringify(base32.parse(secret, { loose: true }))
}
