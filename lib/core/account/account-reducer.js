// 

import { buildReducer, filterReducer, memoizeReducer } from 'redux-keto'







import { ethereumKeyToAddress } from '../../util/crypto/ethereum.js'

import {
  findFirstKey,
  getAllWalletInfos,
  makeAccountType
} from '../login/keys.js'

import { makeLoginTree } from '../login/login.js'
import { findCurrencyPlugin } from '../plugins/plugins-selectors.js'

import { findAppLogin } from './account-init.js'








































const account = buildReducer({
  accountWalletInfo: memoizeReducer(
    (next) => next.self.appId,
    (next) => next.self.login,
    (appId, login) => {
      const type = makeAccountType(appId)
      const accountWalletInfo = findFirstKey(login.keyInfos, type)
      if (accountWalletInfo == null) {
        throw new Error(`Cannot find a "${type}" repo`)
      }
      return accountWalletInfo
    }
  ),

  accountWalletInfos: memoizeReducer(
    (next) => next.self.appId,
    (next) => next.self.login,
    (appId, login) => {
      // Wallets created in Edge that then log into Airbitz or BitcoinPay
      // might end up with wallets stored in the wrong account repo.
      // This code attempts to locate those repos.
      const walletTypes = [makeAccountType(appId)]
      if (appId === '') walletTypes.push('account:repo:co.airbitz.wallet', '')
      return login.keyInfos.filter(info => walletTypes.indexOf(info.type) >= 0)
    }
  ),

  allWalletInfosFull: memoizeReducer(
    (next) => next.self.login,
    (next) => next.self.legacyWalletInfos,
    (next) => next.self.walletStates,
    (
      login,
      legacyWalletInfos,
      walletStates
    ) => {
      const values = getAllWalletInfos(login, legacyWalletInfos)
      const { walletInfos, appIdMap } = values
      const getLast = array => array[array.length - 1]

      return walletInfos.map(info => ({
        appId: getLast(appIdMap[info.id]),
        appIds: appIdMap[info.id],
        archived: false,
        deleted: false,
        sortIndex: walletInfos.length,
        ...walletStates[info.id],
        ...info
      }))
    }
  ),

  allWalletInfosClean: memoizeReducer(
    (next) => next.self.allWalletInfosFull,
    (walletInfos) =>
      walletInfos.map(info => {
        const keys =
          info.type === 'wallet:ethereum'
            ? { ethereumAddress: ethereumKeyToAddress(info.keys.ethereumKey) }
            : {}
        return { ...info, keys }
      })
  ),

  currencyWalletIds: memoizeReducer(
    (next) => next.self.walletInfos,
    (next) => next.root.plugins.currency,
    (walletInfos, plugins) =>
      Object.keys(walletInfos)
        .filter(walletId => {
          const info = walletInfos[walletId]
          return !info.deleted && findCurrencyPlugin(plugins, info.type) != null
        })
        .sort((walletId1, walletId2) => {
          const info1 = walletInfos[walletId1]
          const info2 = walletInfos[walletId2]
          return info1.sortIndex - info2.sortIndex
        })
  ),

  activeWalletIds: memoizeReducer(
    (next) => next.self.walletInfos,
    (next) => next.self.currencyWalletIds,
    (next) => next.self.keysLoaded,
    (walletInfos, ids, keysLoaded) =>
      keysLoaded ? ids.filter(id => !walletInfos[id].archived) : []
  ),

  archivedWalletIds: memoizeReducer(
    (next) => next.self.walletInfos,
    (next) => next.self.currencyWalletIds,
    (next) => next.self.keysLoaded,
    (walletInfos, ids, keysLoaded) =>
      keysLoaded ? ids.filter(id => walletInfos[id].archived) : []
  ),

  keysLoaded(state = false, action) {
    return action.type === 'ACCOUNT_KEYS_LOADED' ? true : state
  },

  legacyWalletInfos(state = [], action) {
    return action.type === 'ACCOUNT_KEYS_LOADED'
      ? action.payload.legacyWalletInfos
      : state
  },

  walletInfos: memoizeReducer(
    (next) => next.self.allWalletInfosFull,
    (walletInfos) => {
      const out = {}
      for (const info of walletInfos) {
        out[info.id] = info
      }
      return out
    }
  ),

  walletStates(state = {}, action) {
    return action.type === 'ACCOUNT_CHANGED_WALLET_STATES' ||
      action.type === 'ACCOUNT_KEYS_LOADED'
      ? action.payload.walletStates
      : state
  },

  appId(state, action) {
    return action.type === 'LOGIN' ? action.payload.appId : state
  },

  loadFailure(state = null, action) {
    return action.type === 'ACCOUNT_LOAD_FAILED' ? action.payload.error : state
  },

  login: memoizeReducer(
    (next) => next.self.appId,
    (next) => next.self.loginTree,
    (appId, loginTree) => findAppLogin(loginTree, appId)
  ),

  loginKey(state, action) {
    return action.type === 'LOGIN' ? action.payload.loginKey : state
  },

  loginTree: memoizeReducer(
    (next) => next.self.appId,
    (next) => next.self.loginKey,
    (next) => next.self.rootLogin,
    (next) => next.root.login.stashes[next.self.username],
    (appId, loginKey, rootLogin, stashTree) =>
      makeLoginTree(stashTree, loginKey, rootLogin ? '' : appId)
  ),

  loginType(state, action) {
    return action.type === 'LOGIN' ? action.payload.loginType : state
  },

  rootLogin(state, action) {
    return action.type === 'LOGIN' ? action.payload.rootLogin : state
  },

  username(state, action) {
    return action.type === 'LOGIN' ? action.payload.username : state
  },

  swapSettings(state = {}, action) {
    switch (action.type) {
      case 'ACCOUNT_PLUGIN_SETTINGS_LOADED':
        return action.payload.swapSettings

      case 'ACCOUNT_SWAP_SETTINGS_CHANGED': {
        const { pluginName, swapSettings } = action.payload
        const out = { ...state }
        out[pluginName] = swapSettings
        return out
      }
    }
    return state
  },

  userSettings(state = {}, action) {
    switch (action.type) {
      case 'ACCOUNT_PLUGIN_SETTINGS_CHANGED': {
        const { pluginName, userSettings } = action.payload
        const out = { ...state }
        out[pluginName] = userSettings
        return out
      }

      case 'ACCOUNT_PLUGIN_SETTINGS_LOADED':
        return action.payload.userSettings
    }
    return state
  }
})

export const accountReducer = filterReducer(
  account,
  (action, next) => {
    if (
      /^ACCOUNT_/.test(action.type) &&
      action.payload != null &&
      action.payload.accountId === next.id
    ) {
      return action
    }

    if (action.type === 'LOGIN' && next.root.lastAccountId === next.id) {
      return action
    }

    return { type: 'PROPS_UPDATE' }
  }
)
