


import { bridgifyObject } from 'yaob'


import { decrypt, encrypt } from '../../util/crypto/crypto.js'
import { utf8 } from '../../util/encoding.js'

export function encryptDisklet(
  io,
  dataKey,
  disklet
) {
  const out = {
    delete(path) {
      return disklet.delete(path)
    },

    getData(path) {
      return disklet
        .getText(path)
        .then(text => JSON.parse(text))
        .then(json => decrypt(json, dataKey))
    },

    getText(path) {
      return this.getData(path).then(data => utf8.stringify(data))
    },

    list(path) {
      return disklet.list(path)
    },

    setData(path, data) {
      const dataCast = data // Treating Array<number> like Uint8Array
      return disklet.setText(
        path,
        JSON.stringify(encrypt(io, dataCast, dataKey))
      )
    },

    setText(path, text) {
      return this.setData(path, utf8.parse(text))
    }
  }
  bridgifyObject(out)
  return out
}
