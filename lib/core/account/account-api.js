


import { bridgifyObject, onMethod, watchMethod } from 'yaob'

import { AccountSync } from '../../client-side.js'

















import { signEthereumTransaction } from '../../util/crypto/ethereum.js'
import { deprecate } from '../../util/deprecate.js'
import { base58 } from '../../util/encoding.js'
import { makeExchangeCache } from '../exchange/exchange-api.js'
import {
  createCurrencyWallet,
  listSplittableWalletTypes,
  makeKeysKit,
  makeStorageKeyInfo,
  splitWalletInfo
} from '../login/keys.js'
import { applyKit } from '../login/login.js'
import { cancelOtpReset, disableOtp, enableOtp } from '../login/otp.js'
import {
  changePassword,
  checkPassword,
  deletePassword
} from '../login/password.js'
import { changePin, checkPin2, deletePin } from '../login/pin2.js'
import { changeRecovery, deleteRecovery } from '../login/recovery2.js'
import { getCurrencyTools } from '../plugins/plugins-selectors.js'

import { makeStorageWalletApi } from '../storage/storage-api.js'
import { fetchSwapQuote } from '../swap/swap-api.js'
import { changeWalletStates } from './account-files.js'
import { makeDataStoreApi, makePluginDataApi } from './data-store-api.js'
import { makeLobbyApi } from './lobby-api.js'
import { CurrencyConfig, SwapConfig } from './plugin-api.js'

/**
 * Creates an unwrapped account API object around an account state object.
 */
export function makeAccountApi(ai, accountId) {
  const selfState = () => ai.props.state.accounts[accountId]
  const { accountWalletInfo, loginType, loginTree } = selfState()
  const { username } = loginTree

  // Plugin config API's:
  const currencyConfigs = {}
  for (const pluginName in ai.props.state.plugins.currency) {
    const api = new CurrencyConfig(ai, accountId, pluginName)
    currencyConfigs[pluginName] = api
  }
  const swapConfigs = {}
  for (const pluginName in ai.props.state.plugins.swap) {
    const api = new SwapConfig(ai, accountId, pluginName)
    swapConfigs[pluginName] = api
  }

  // Specialty API's:
  const rateCache = makeExchangeCache(ai)
  const dataStore = makeDataStoreApi(ai, accountId)
  const pluginData = makePluginDataApi(dataStore)
  const storageWalletApi = makeStorageWalletApi(ai, accountWalletInfo)

  function lockdown() {
    if (ai.props.state.hideKeys) {
      throw new Error('Not available when `hideKeys` is enabled')
    }
  }

  const out = {
    on: onMethod,
    watch: watchMethod,

    // Data store:
    get id() {
      return storageWalletApi.id
    },
    get type() {
      return storageWalletApi.type
    },
    get keys() {
      lockdown()
      return storageWalletApi.keys
    },
    get disklet() {
      lockdown()
      return storageWalletApi.disklet
    },
    get localDisklet() {
      lockdown()
      return storageWalletApi.localDisklet
    },
    async sync() {
      return storageWalletApi.sync()
    },

    // Basic login information:
    get appId() {
      return selfState().login.appId
    },
    get loggedIn() {
      return selfState() != null
    },
    get loginKey() {
      lockdown()
      return base58.stringify(selfState().login.loginKey)
    },
    get recoveryKey() {
      lockdown()
      const { login } = selfState()
      return login.recovery2Key != null
        ? base58.stringify(login.recovery2Key)
        : undefined
    },
    get username() {
      if (!username) throw new Error('Missing username')
      return username
    },

    // Speciality API's:
    get currencyConfig() {
      return currencyConfigs
    },
    get swapConfig() {
      return swapConfigs
    },
    get rateCache() {
      return rateCache
    },
    get dataStore() {
      return dataStore
    },

    // What login method was used?
    get edgeLogin() {
      const { loginTree } = selfState()
      return loginTree.loginKey == null
    },
    keyLogin: loginType === 'keyLogin',
    newAccount: loginType === 'newAccount',
    passwordLogin: loginType === 'passwordLogin',
    pinLogin: loginType === 'pinLogin',
    recoveryLogin: loginType === 'recoveryLogin',

    // Change or create credentials:
    async changePassword(password) {
      lockdown()
      return changePassword(ai, accountId, password).then(() => {})
    },
    async changePin(opts


) {
      lockdown()
      const { pin, enableLogin } = opts
      return changePin(ai, accountId, pin, enableLogin).then(() => {
        const { login } = selfState()
        return login.pin2Key ? base58.stringify(login.pin2Key) : ''
      })
    },
    async changeRecovery(
      questions,
      answers
    ) {
      lockdown()
      return changeRecovery(ai, accountId, questions, answers).then(() => {
        const { loginTree } = selfState()
        if (!loginTree.recovery2Key) {
          throw new Error('Missing recoveryKey')
        }
        return base58.stringify(loginTree.recovery2Key)
      })
    },

    // Verify existing credentials:
    async checkPassword(password) {
      lockdown()
      const { loginTree } = selfState()
      return checkPassword(ai, loginTree, password)
    },
    async checkPin(pin) {
      lockdown()
      const { login, loginTree } = selfState()

      // Try to check the PIN locally, then fall back on the server:
      return login.pin != null
        ? pin === login.pin
        : checkPin2(ai, loginTree, pin)
    },

    // Remove credentials:
    async deletePassword() {
      lockdown()
      return deletePassword(ai, accountId).then(() => {})
    },
    async deletePin() {
      lockdown()
      return deletePin(ai, accountId).then(() => {})
    },
    async deleteRecovery() {
      lockdown()
      return deleteRecovery(ai, accountId).then(() => {})
    },

    // OTP:
    get otpKey() {
      lockdown()
      const { loginTree } = selfState()
      return loginTree.otpTimeout != null ? loginTree.otpKey : undefined
    },
    get otpResetDate() {
      lockdown()
      const { loginTree } = selfState()
      return loginTree.otpResetDate
    },
    async cancelOtpReset() {
      lockdown()
      return cancelOtpReset(ai, accountId).then(() => {})
    },
    async enableOtp(timeout = 7 * 24 * 60 * 60) {
      lockdown()
      return enableOtp(ai, accountId, timeout).then(() => {})
    },
    async disableOtp() {
      lockdown()
      return disableOtp(ai, accountId).then(() => {})
    },

    // Edge login approval:
    async fetchLobby(lobbyId) {
      lockdown()
      return makeLobbyApi(ai, accountId, lobbyId)
    },

    // Login management:
    async logout() {
      ai.props.dispatch({ type: 'LOGOUT', payload: { accountId } })
    },

    // Master wallet list:
    get allKeys() {
      return ai.props.state.hideKeys
        ? ai.props.state.accounts[accountId].allWalletInfosClean
        : ai.props.state.accounts[accountId].allWalletInfosFull
    },
    async changeWalletStates(walletStates) {
      return changeWalletStates(ai, accountId, walletStates)
    },
    async createWallet(walletType, keys) {
      const { login, loginTree } = selfState()

      if (keys == null) {
        // Use the currency plugin to create the keys:
        const tools = await getCurrencyTools(ai, walletType)
        keys = await tools.createPrivateKey(walletType)
      }

      const walletInfo = makeStorageKeyInfo(ai, walletType, keys)
      const kit = makeKeysKit(ai, login, walletInfo)
      return applyKit(ai, loginTree, kit).then(() => walletInfo.id)
    },
    getFirstWalletInfo: AccountSync.prototype.getFirstWalletInfo,
    getWalletInfo: AccountSync.prototype.getWalletInfo,
    listWalletIds: AccountSync.prototype.listWalletIds,
    async splitWalletInfo(
      walletId,
      newWalletType
    ) {
      return splitWalletInfo(ai, accountId, walletId, newWalletType)
    },
    async listSplittableWalletTypes(walletId) {
      return listSplittableWalletTypes(ai, accountId, walletId)
    },

    // Currency wallets:
    get activeWalletIds() {
      return ai.props.state.accounts[accountId].activeWalletIds
    },
    get archivedWalletIds() {
      return ai.props.state.accounts[accountId].archivedWalletIds
    },
    get currencyWallets() {
      return ai.props.output.accounts[accountId].currencyWallets
    },
    async createCurrencyWallet(
      type,
      opts = {}
    ) {
      return createCurrencyWallet(ai, accountId, type, opts)
    },
    async waitForCurrencyWallet(walletId) {
      return new Promise(resolve => {
        const f = currencyWallets => {
          const wallet = this.currencyWallets[walletId]
          if (wallet != null) {
            resolve(wallet)
            unsubscribe()
          }
        }
        const unsubscribe = this.watch('currencyWallets', f)
        f()
      })
    },

    async signEthereumTransaction(
      walletId,
      transaction
    ) {
      console.log('Edge is signing: ', transaction)
      const { allWalletInfosFull } = selfState()
      const walletInfo = allWalletInfosFull.find(info => info.id === walletId)
      if (!walletInfo || !walletInfo.keys || !walletInfo.keys.ethereumKey) {
        throw new Error('Cannot find the requested private key in the account')
      }
      return signEthereumTransaction(walletInfo.keys.ethereumKey, transaction)
    },

    async fetchSwapQuote(request) {
      return fetchSwapQuote(ai, accountId, request)
    },

    // Deprecated names:
    get currencyTools() {
      return currencyConfigs
    },
    get exchangeTools() {
      return swapConfigs
    },
    get exchangeCache() {
      return rateCache
    },
    get pluginData() {
      return pluginData
    },
    async getExchangeQuote(request) {
      deprecate('EdgeAccount.getExchangeQuote', 'EdgeAccount.fetchSwapQuote')
      return this.fetchSwapQuote(request)
    }
  }
  bridgifyObject(out)

  return out
}
