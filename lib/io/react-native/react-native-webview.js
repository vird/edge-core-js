const _jsxFileName = "src/io/react-native/react-native-webview.js";// 

import '../../client-side.js'

import React, { Component } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import RNFS from 'react-native-fs'
import { WebView } from 'react-native-webview'
import { Bridge, bridgifyObject, onMethod } from 'yaob'


import { makeClientIo } from './react-native-io.js'














/**
 * Sets up a YAOB bridge for use with a React Native WebView.
 * The returned callbacks should be passed to the `onMessage` and `ref`
 * properties of the WebView. Handles WebView reloads and related
 * race conditions.
 * @param {*} onRoot Called when the inner HTML sends a root object.
 * May be called multiple times if the inner HTML reloads.
 * @param {*} debug Provide a message prefix to enable debugging.
 */
function makeOuterWebViewBridge(
  onRoot,
  debug
) {
  let bridge
  let gatedRoot
  let webview

  // Gate the root object on the webview being ready:
  const tryReleasingRoot = () => {
    if (gatedRoot != null && webview != null) {
      onRoot(gatedRoot)
      gatedRoot = undefined
    }
  }

  // Feed incoming messages into the YAOB bridge (if any):
  const handleMessage = event => {
    const message = JSON.parse(event.nativeEvent.data)
    if (debug != null) console.info(`${debug} →`, message)

    // This is a terrible hack. We are using our inside knowledge
    // of YAOB's message format to determine when the client has restarted.
    if (
      bridge != null &&
      message.events != null &&
      message.events.find(event => event.localId === 0)
    ) {
      bridge.close(new Error('edge-core: The WebView has been unmounted.'))
      bridge = undefined
    }

    // If we have no bridge, start one:
    if (bridge == null) {
      let firstMessage = true
      bridge = new Bridge({
        sendMessage: message => {
          if (debug != null) console.info(`${debug} ←`, message)
          if (webview == null) return

          const js = `if (window.bridge != null) {${
            firstMessage
              ? 'window.gotFirstMessage = true;'
              : 'window.gotFirstMessage && '
          } window.bridge.handleMessage(${JSON.stringify(message)})}`
          firstMessage = false
          webview.injectJavaScript(js)
        }
      })

      // Use our inside knowledge of YAOB to directly
      // subscribe to the root object appearing:
      onMethod.call(bridge._state, 'root', root => {
        gatedRoot = root
        tryReleasingRoot()
      })
    }

    // Finally, pass the message to the bridge:
    bridge.handleMessage(message)
  }

  // Listen for the webview component to mount:
  const setRef = element => {
    webview = element
    tryReleasingRoot()
  }

  return { handleMessage, setRef }
}

/**
 * Launches the Edge core worker in a WebView and returns its API.
 */
export class EdgeCoreBridge extends Component {
  

  constructor(props) {
    super(props)
    const { nativeIo = {}, debug = false } = props

    // Set up the native IO objects:
    const nativeIoPromise = makeClientIo().then(coreIo => {
      const bridgedIo = { 'edge-core': coreIo }
      for (const n in nativeIo) {
        bridgedIo[n] = bridgifyObject(nativeIo[n])
      }
      return bridgedIo
    })

    // Set up the YAOB bridge:
    this.callbacks = makeOuterWebViewBridge(
      (root) => {
        nativeIoPromise
          .then(nativeIo => props.onLoad(nativeIo, root))
          .catch(error => props.onError(error))
      },
      debug ? 'edge-core' : undefined
    )
  }

  render() {
    let uri =
      Platform.OS === 'android'
        ? 'file:///android_asset/edge-core/index.html'
        : `file://${RNFS.MainBundlePath}/edge-core/index.html`
    if (this.props.debug) {
      uri += '?debug=true'
      console.log(`edge core at ${uri}`)
    }

    return (
      React.createElement(View, { style: this.props.debug ? styles.debug : styles.hidden, __self: this, __source: {fileName: _jsxFileName, lineNumber: 148}}
        , React.createElement(WebView, {
          allowFileAccess: true,
          onMessage: this.callbacks.handleMessage,
          originWhitelist: ['file://*'],
          ref: this.callbacks.setRef,
          source: { uri }, __self: this, __source: {fileName: _jsxFileName, lineNumber: 149}}
        )
      )
    )
  }
}

const styles = StyleSheet.create({
  debug: {
    alignSelf: 'center',
    position: 'absolute',
    height: 10,
    width: 10,
    top: 50
  },
  hidden: { position: 'absolute', height: 0, width: 0 }
})
