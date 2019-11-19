// 

import { buildReducer, mapReducer } from 'redux-keto'

import { accountReducer } from './account/account-reducer.js'

import { currency } from './currency/currency-reducer.js'
import {

  exchangeCache
} from './exchange/exchange-reducer.js'
import { login } from './login/login-reducer.js'
import { plugins } from './plugins/plugins-reducer.js'
import {

  storageWallets
} from './storage/storage-reducer.js'
















export const reducer = buildReducer({
  accountCount(state = 0, action) {
    return action.type === 'LOGIN' ? state + 1 : state
  },

  accountIds(state = [], action, next) {
    switch (action.type) {
      case 'LOGIN':
        return [...state, next.lastAccountId]

      case 'LOGOUT': {
        const { accountId } = action.payload
        const out = state.filter(id => id !== accountId)
        if (out.length === state.length) {
          throw new Error(`Login ${accountId} does not exist`)
        }
        return out
      }

      case 'CLOSE':
        return []
    }
    return state
  },

  accounts: mapReducer(accountReducer, (next) => next.accountIds),

  hideKeys(state = true, action) {
    return action.type === 'INIT' ? action.payload.hideKeys : state
  },

  lastAccountId(state, action, next) {
    return 'login' + next.accountCount.toString()
  },

  paused(state = false, action) {
    return action.type === 'PAUSE' ? action.payload : state
  },

  currency,
  exchangeCache,
  login,
  plugins,
  storageWallets
})
