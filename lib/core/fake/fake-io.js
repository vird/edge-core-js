// 

import { makeMemoryDisklet } from 'disklet'


import { scrypt } from '../../util/crypto/scrypt.js'
import { FakeWebSocket } from './fake-socket.js'

/**
 * Silences all logging.
 */
export const fakeConsole = {
  info: () => {},
  warn: () => {},
  error: () => {}
}

/**
 * Generates deterministic "random" data for unit-testing.
 */
function makeFakeRandom() {
  let seed = 0

  return (bytes) => {
    const out = new Uint8Array(bytes)

    for (let i = 0; i < bytes; ++i) {
      // Simplest numbers that give a full-period generator with
      // a good mix of high & low values within the first few bytes:
      seed = (5 * seed + 3) & 0xff
      out[i] = seed
    }

    return out
  }
}

function fakeFetch() {
  return Promise.reject(new Error('Fake network error'))
}

/**
 * Creates a simulated io context object.
 */
export function makeFakeIo() {
  const out = {
    // Crypto:
    random: makeFakeRandom(),
    scrypt,

    // Local io:
    console: fakeConsole,
    disklet: makeMemoryDisklet(),

    // Networking:
    fetch: fakeFetch,
    WebSocket: FakeWebSocket
  }

  return out
}
