// 

import { Bridgeable, bridgifyObject } from 'yaob'







import { getCurrencyTools } from '../plugins/plugins-selectors.js'

import {
  changePluginUserSettings,
  changeSwapSettings
} from './account-files.js'
import { swapPluginEnabled } from './account-selectors.js'

/**
 * Access to an individual currency plugin's methods.
 */
export class CurrencyConfig extends Bridgeable {
  
  
  

  

  constructor(ai, accountId, pluginName) {
    super()
    this._ai = ai
    this._accountId = accountId
    this._pluginName = pluginName

    const { otherMethods } = ai.props.state.plugins.currency[pluginName]
    if (otherMethods != null) {
      bridgifyObject(otherMethods)
      this.otherMethods = otherMethods
    } else {
      this.otherMethods = {}
    }
  }

  get currencyInfo() {
    return this._ai.props.state.plugins.currency[this._pluginName].currencyInfo
  }

  get userSettings() {
    const selfState = this._ai.props.state.accounts[this._accountId]
    return selfState.userSettings[this._pluginName]
  }

  async changeUserSettings(settings) {
    await changePluginUserSettings(
      this._ai,
      this._accountId,
      this._pluginName,
      settings
    )
  }

  async importKey(userInput) {
    const tools = await getCurrencyTools(this._ai, this.currencyInfo.walletType)

    if (tools.importPrivateKey == null) {
      throw new Error('This wallet does not support importing keys')
    }
    return tools.importPrivateKey(userInput)
  }
}

export class SwapConfig extends Bridgeable {
  
  
  

  constructor(ai, accountId, pluginName) {
    super()
    this._ai = ai
    this._accountId = accountId
    this._pluginName = pluginName
  }

  get enabled() {
    const account = this._ai.props.state.accounts[this._accountId]
    return swapPluginEnabled(account.swapSettings, this._pluginName)
  }

  get needsActivation() {
    const plugin = this._ai.props.state.plugins.swap[this._pluginName]
    if (plugin.checkSettings == null) return false

    const selfState = this._ai.props.state.accounts[this._accountId]
    const settings = selfState.userSettings[this._pluginName] || {}
    return !!plugin.checkSettings(settings).needsActivation
  }

  get swapInfo() {
    return this._ai.props.state.plugins.swap[this._pluginName].swapInfo
  }

  get userSettings() {
    const selfState = this._ai.props.state.accounts[this._accountId]
    return selfState.userSettings[this._pluginName]
  }

  async changeEnabled(enabled) {
    const account = this._ai.props.state.accounts[this._accountId]
    return changeSwapSettings(this._ai, this._accountId, this._pluginName, {
      ...account.swapSettings[this._pluginName],
      enabled
    })
  }

  async changeUserSettings(settings) {
    await changePluginUserSettings(
      this._ai,
      this._accountId,
      this._pluginName,
      settings
    )
  }
}
