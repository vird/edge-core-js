// 

import { buildReducer, mapReducer, memoizeReducer } from 'redux-keto'









import {

  currencyWalletReducer
} from './wallet/currency-wallet-reducer.js'








export const currency = buildReducer({
  currencyWalletIds(state, action, next) {
    // Optimize the common case:
    if (next.accountIds.length === 1) {
      const id = next.accountIds[0]
      return next.accounts[id].activeWalletIds
    }

    const allIds = next.accountIds.map(
      accountId => next.accounts[accountId].activeWalletIds
    )
    return [].concat(...allIds)
  },

  customTokens(state = [], action) {
    if (action.type === 'ADDED_CUSTOM_TOKEN') {
      const {
        currencyCode,
        currencyName,
        contractAddress,
        multiplier
      } = action.payload
      const token = {
        currencyCode,
        currencyName,
        contractAddress,
        denominations: [
          {
            name: currencyCode,
            multiplier
          }
        ]
      }
      const out = state.filter(info => info.currencyCode !== currencyCode)
      out.push(token)
      return out
    }
    return state
  },

  infos: memoizeReducer(
    (state) => state.plugins.currency,
    (plugins) => {
      const out = []
      for (const pluginName in plugins) {
        out.push(plugins[pluginName].currencyInfo)
      }
      return out
    }
  ),

  wallets: mapReducer(
    currencyWalletReducer,
    (props) => props.currency.currencyWalletIds
  )
})
