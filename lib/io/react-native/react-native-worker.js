// 

import './polyfills.js'

import hashjs from 'hash.js'
import HmacDRBG from 'hmac-drbg'
import { base64 } from 'rfc4648'
import { Bridge, bridgifyObject } from 'yaob'

import {
  addEdgeCorePlugins,
  lockEdgeCorePlugins,
  makeContext,
  makeFakeWorld
} from '../../core/core.js'



const body = document.body
if (body != null && /debug=true/.test(window.location)) {
  const update = () => {
    const wave = Math.abs(((Date.now() / 2000) % 2) - 1)
    const color = 0x40 + 0x80 * wave
    body.style.backgroundColor = `rgb(${color}, ${color}, ${color})`

    setTimeout(update, 100)
  }
  update()
}

window.addEdgeCorePlugins = addEdgeCorePlugins
window.lockEdgeCorePlugins = lockEdgeCorePlugins

function makeIo(nativeIo) {
  const clientIo = nativeIo['edge-core']
  const { console, disklet, entropy, scrypt } = clientIo
  const csprng = new HmacDRBG({
    hash: hashjs.sha256,
    entropy: base64.parse(entropy)
  })

  return {
    console,
    disklet,

    fetch: (...args) => window.fetch(...args),
    WebSocket: window.WebSocket,

    random: bytes => csprng.generate(bytes),
    scrypt
  }
}

const workerApi = bridgifyObject({
  makeEdgeContext(nativeIo, opts) {
    return makeContext(makeIo(nativeIo), nativeIo, opts)
  },

  makeFakeEdgeWorld(nativeIo, users = []) {
    return Promise.resolve(makeFakeWorld(makeIo(nativeIo), nativeIo, users))
  }
})

/**
 * Legacy WebView support.
 */
function oldSendRoot() {
  if (window.originalPostMessage != null) {
    const reactPostMessage = window.postMessage
    window.postMessage = window.originalPostMessage
    window.bridge = new Bridge({
      sendMessage: message => reactPostMessage(JSON.stringify(message))
    })
    window.bridge.sendRoot(workerApi)
  } else {
    setTimeout(oldSendRoot, 100)
  }
}

// Start the object bridge:
if (window.ReactNativeWebView != null) {
  window.bridge = new Bridge({
    sendMessage(message) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message))
    }
  })
  window.bridge.sendRoot(workerApi)
} else {
  oldSendRoot()
}
