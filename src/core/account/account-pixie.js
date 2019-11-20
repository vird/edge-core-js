// @flow

import {
  type PixieInput,
  type TamePixie,
  combinePixies,
  filterPixie,
  mapPixie,
  stopUpdates
} from 'redux-pixies'
import { close, emit, update } from 'yaob'

import { type EdgeAccount, type EdgeCurrencyWallet } from '../../types/types.js'
import { waitForPlugins } from '../plugins/plugins-selectors.js'
import { type ApiInput, type RootProps } from '../root-pixie.js'
import {
  addStorageWallet,
  syncStorageWallet
} from '../storage/storage-actions.js'
import { makeAccountApi } from './account-api.js'
import { loadAllWalletStates, reloadPluginSettings } from './account-files.js'
import { type AccountState } from './account-reducer.js'

export type AccountOutput = {
  +api: EdgeAccount,
  +currencyWallets: { [walletId: string]: EdgeCurrencyWallet }
}

export type AccountProps = RootProps & {
  +id: string,
  +selfState: AccountState,
  +selfOutput: AccountOutput
}

export type AccountInput = PixieInput<AccountProps>

const accountPixie: TamePixie<AccountProps> = combinePixies({
  api(input: AccountInput) {
    return {
      destroy() {
        // The Pixie library stops updating props after destruction,
        // so we are stuck seeing the logged-in state. Fix that:
        const hack: any = input.props
        hack.state = { accounts: {} }

        if (
          input.props.selfOutput != null &&
          input.props.selfOutput.api != null
        ) {
          update(input.props.selfOutput.api)
          close(input.props.selfOutput.api)
          close(input.props.selfOutput.api.dataStore)
          close(input.props.selfOutput.api.exchangeCache)
          close(input.props.selfOutput.api.pluginData)
          const currencies = input.props.selfOutput.api.currencyConfig
          for (const n of Object.keys(currencies)) close(currencies[n])
          const swaps = input.props.selfOutput.api.swapConfig
          for (const n of Object.keys(swaps)) close(swaps[n])
        }
      },

      async update() {
        const ai: ApiInput = (input: any) // Safe, since input extends ApiInput
        const accountId = input.props.id
        const io = input.props.io
        const { accountWalletInfos } = input.props.selfState

        const loadAllFiles = async () => {
          await Promise.all([
            reloadPluginSettings(ai, accountId),
            loadAllWalletStates(ai, accountId)
          ])
        }

        try {
          // Wait for the currency plugins (should already be loaded by now):
          await waitForPlugins(ai)
          io.console.info('Login: currency plugins exist')

          // Start the repo:
          await Promise.all(
            accountWalletInfos.map(info => addStorageWallet(ai, info))
          )
          io.console.info('Login: synced account repos')

          await loadAllFiles()
          io.console.info('Login: loaded files')

          // Create the API object:
          input.onOutput(makeAccountApi(ai, accountId))
          io.console.info('Login: complete')
        } catch (error) {
          input.props.dispatch({
            type: 'ACCOUNT_LOAD_FAILED',
            payload: { accountId, error }
          })
        }

        return stopUpdates
      }
    }
  },

  // Starts & stops the sync timer for this account:
  syncTimer: filterPixie(
    (input: AccountInput) => {
      let started: boolean = false
      let stopped: boolean = false
      let timeout: * // Infer the proper timer type

      async function doSync() {
        const ai: ApiInput = (input: any) // Safe, since input extends ApiInput
        const accountId = input.props.id
        const { accountWalletInfos } = input.props.selfState

        try {
          if (input.props.state.accounts[accountId] == null) return
          const changeLists = await Promise.all(
            accountWalletInfos.map(info => syncStorageWallet(ai, info.id))
          )
          const changes: Array<string> = [].concat(...changeLists)
          if (changes.length) {
            await Promise.all([
              reloadPluginSettings(ai, accountId),
              loadAllWalletStates(ai, accountId)
            ])
          }
        } catch (e) {
          // We don't report sync failures, since that could be annoying.
        }

        if (!stopped) timeout = setTimeout(doSync, 30 * 1000)
      }

      return {
        update() {
          if (
            !started &&
            input.props.selfOutput &&
            input.props.selfOutput.api
          ) {
            started = true
            doSync()
          }
        },

        destroy() {
          stopped = true
          if (timeout != null) clearTimeout(timeout)
        }
      }
    },
    props => (props.state.paused ? undefined : props)
  ),

  watcher(input: AccountInput) {
    let lastState
    let lastWallets
    let lastExchangeState

    return () => {
      const { selfState, selfOutput } = input.props
      if (selfState == null || selfOutput == null) return

      // General account state:
      if (true) {
        lastState = selfState
        if (selfOutput.api != null) {
          update(selfOutput.api)
          for (const pluginName in selfOutput.api.currencyConfig) {
            update(selfOutput.api.currencyConfig[pluginName])
          }
          for (const pluginName in selfOutput.api.swapConfig) {
            update(selfOutput.api.swapConfig[pluginName])
          }
        }
      }

      // Wallet list:
      if (lastWallets !== input.props.output.currency.wallets) {
        lastWallets = input.props.output.currency.wallets
        if (selfOutput.api != null) update(selfOutput.api)
      }

      // Exchange:
      if (lastExchangeState !== input.props.state.exchangeCache) {
        lastExchangeState = input.props.state.exchangeCache
        if (selfOutput.api != null) {
          emit(selfOutput.api.exchangeCache, 'update', undefined)
        }
      }
    }
  },

  currencyWallets(input: AccountInput) {
    let lastActiveWalletIds

    return () => {
      const { activeWalletIds } = input.props.selfState
      let dirty = lastActiveWalletIds !== activeWalletIds
      lastActiveWalletIds = activeWalletIds

      let lastOut = {}
      if (input.props.selfOutput && input.props.selfOutput.currencyWallets) {
        lastOut = input.props.selfOutput.currencyWallets
      }

      const out = {}
      for (const walletId of activeWalletIds) {
        if (
          input.props.output.currency.wallets[walletId] != null &&
          input.props.output.currency.wallets[walletId].api != null
        ) {
          const api = input.props.output.currency.wallets[walletId].api
          if (api !== lastOut[walletId]) dirty = true
          out[walletId] = api
        }
      }

      if (dirty) input.onOutput(out)
    }
  }
})

export const accounts: TamePixie<RootProps> = mapPixie(
  accountPixie,
  (props: RootProps) => props.state.accountIds,
  (props: RootProps, id: string): AccountProps => ({
    ...props,
    id,
    selfState: props.state.accounts[id],
    selfOutput: props.output.accounts[id]
  })
)
