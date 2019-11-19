// 

import { buildReducer, memoizeReducer } from 'redux-keto'





import { getPin2Key } from './pin2.js'
import { server } from './server/login-server-reducer.js'











export const login = buildReducer({
  appId(state = '', action) {
    return action.type === 'INIT' ? action.payload.appId : state
  },

  localUsers: memoizeReducer(
    (next) => next.login.appId,
    (next) => next.login.stashes,
    (appId, stashes) => {
      const out = []
      for (const username in stashes) {
        const stash = stashes[username]
        const pin2Key = getPin2Key(stash, appId)
        out.push({
          pinLoginEnabled: pin2Key.pin2Key != null,
          username
        })
      }
      return out
    }
  ),

  server,

  stashes(state = {}, action) {
    switch (action.type) {
      case 'INIT': {
        const out = {}

        // Extract the usernames from the top-level objects:
        for (const filename of Object.keys(action.payload.stashes)) {
          const json = action.payload.stashes[filename]
          if (json && json.username && json.loginId) {
            const { username } = json
            out[username] = json
          }
        }

        return out
      }

      case 'LOGIN_STASH_DELETED': {
        const copy = { ...state }
        delete copy[action.payload]
        return copy
      }

      case 'LOGIN_STASH_SAVED': {
        const { username } = action.payload
        if (!username) throw new Error('Missing username')

        const out = { ...state }
        out[username] = action.payload
        return out
      }
    }
    return state
  },

  walletInfos(state, action, next) {
    // Optimize the common case:
    if (next.accountIds.length === 1) {
      const id = next.accountIds[0]
      return next.accounts[id].walletInfos
    }

    const out = {}
    for (const accountId of next.accountIds) {
      const account = next.accounts[accountId]
      for (const id of Object.keys(account.walletInfos)) {
        const info = account.walletInfos[id]
        out[id] = info
      }
    }
    return out
  }
})
