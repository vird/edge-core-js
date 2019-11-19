// 

import { add, div, lte, mul, sub } from 'biggystring'

import { bridgifyObject, onMethod, watchMethod } from 'yaob'

import { CurrencyWalletSync } from '../../../client-side.js'



















import { filterObject, mergeDeeply } from '../../../util/util.js'
import { getCurrencyTools } from '../../plugins/plugins-selectors.js'

import { makeStorageWalletApi } from '../../storage/storage-api.js'
import { getCurrencyMultiplier } from '../currency-selectors.js'
import { makeCurrencyWalletCallbacks } from './currency-wallet-callbacks.js'
import {
  exportTransactionsToCSVInner,
  exportTransactionsToQBOInner
} from './currency-wallet-export.js'
import {

  loadTxFiles,
  renameCurrencyWallet,
  setCurrencyWalletFiat,
  setCurrencyWalletTxMetadata
} from './currency-wallet-files.js'



const fakeMetadata = {
  bizId: 0,
  category: '',
  exchangeAmount: {},
  name: '',
  notes: ''
}

/**
 * Creates an `EdgeCurrencyWallet` API object.
 */
export function makeCurrencyWalletApi(
  input,
  plugin,
  engine,
  publicWalletInfo
) {
  const ai = (input) // Safe, since input extends ApiInput
  const { walletInfo } = input.props.selfState

  const storageWalletApi = makeStorageWalletApi(ai, walletInfo)

  const fakeCallbacks = makeCurrencyWalletCallbacks(input)

  let otherMethods = {}
  if (engine.otherMethods != null) {
    otherMethods = engine.otherMethods
    bridgifyObject(otherMethods)
  }

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
    publicWalletInfo,
    get disklet() {
      return storageWalletApi.disklet
    },
    get localDisklet() {
      return storageWalletApi.localDisklet
    },
    async sync() {
      return storageWalletApi.sync()
    },

    // Wallet keys:
    get displayPrivateSeed() {
      lockdown()
      return input.props.selfState.displayPrivateSeed
    },
    get displayPublicSeed() {
      return input.props.selfState.displayPublicSeed
    },

    // Wallet name:
    get name() {
      return input.props.selfState.name
    },
    async renameWallet(name) {
      return renameCurrencyWallet(input, name).then(() => {})
    },

    // Currency info:
    get currencyInfo() {
      return plugin.currencyInfo
    },
    async nativeToDenomination(
      nativeAmount,
      currencyCode
    ) {
      const multiplier = getCurrencyMultiplier(
        input.props.state.currency.infos,
        input.props.state.currency.customTokens,
        currencyCode
      )
      return div(nativeAmount, multiplier, multiplier.length)
    },
    async denominationToNative(
      denominatedAmount,
      currencyCode
    ) {
      const multiplier = getCurrencyMultiplier(
        input.props.state.currency.infos,
        input.props.state.currency.customTokens,
        currencyCode
      )
      return mul(denominatedAmount, multiplier)
    },

    // Fiat currency option:
    get fiatCurrencyCode() {
      return input.props.selfState.fiat
    },
    async setFiatCurrencyCode(fiatCurrencyCode) {
      return setCurrencyWalletFiat(input, fiatCurrencyCode).then(() => {})
    },

    // Chain state:
    get balances() {
      return input.props.selfState.balances
    },

    get blockHeight() {
      return input.props.selfState.height
    },

    get syncRatio() {
      return input.props.selfState.syncRatio
    },

    // Running state:
    async startEngine() {
      return engine.startEngine()
    },

    async stopEngine() {
      return engine.killEngine()
    },

    // Tokens:
    async enableTokens(tokens) {
      return engine.enableTokens(tokens)
    },

    async disableTokens(tokens) {
      return engine.disableTokens(tokens)
    },

    async getEnabledTokens() {
      return engine.getEnabledTokens()
    },

    async addCustomToken(tokenInfo) {
      ai.props.dispatch({ type: 'ADDED_CUSTOM_TOKEN', payload: tokenInfo })
      return engine.addCustomToken(tokenInfo)
    },

    // Transactions:
    async getNumTransactions(
      opts = {}
    ) {
      return engine.getNumTransactions(opts)
    },

    async getTransactions(
      opts = {}
    ) {
      const defaultCurrency = plugin.currencyInfo.currencyCode
      const currencyCode = opts.currencyCode || defaultCurrency

      let state = input.props.selfState
      if (!state.gotTxs[currencyCode]) {
        const txs = await engine.getTransactions({
          currencyCode: opts.currencyCode
        })
        fakeCallbacks.onTransactionsChanged(txs)
        input.props.dispatch({
          type: 'CURRENCY_ENGINE_GOT_TXS',
          payload: {
            walletId: input.props.id,
            currencyCode
          }
        })
        state = input.props.selfState
      }

      // Txid array of all txs
      const txids = state.txids
      // Merged tx data from metadata files and blockchain data
      const txs = state.txs
      const { startIndex = 0, startEntries = txids.length } = opts
      // Decrypted metadata files
      const files = state.files
      // A sorted list of transaction based on chronological order
      // these are tx id hashes merged between blockchain and cache some tx id hashes
      // some may have been dropped by the blockchain
      const sortedTransactions = state.sortedTransactions.sortedList
      // create map of tx id hashes to their order (cardinality)
      const mappedUnfilteredIndexes = {}
      sortedTransactions.forEach((item, index) => {
        mappedUnfilteredIndexes[item] = index
      })
      // we need to make sure that after slicing, the total txs number is equal to opts.startEntries
      // slice, verify txs in files, if some are dropped and missing, do it again recursively
      const getBulkTx = async (index, out = []) => {
        // if the output is already filled up or we're at the end of the list of transactions
        if (out.length === startEntries || index >= sortedTransactions.length) {
          return out
        }
        // entries left to find = number of entries we're looking for minus the current output length
        const entriesLeft = startEntries - out.length
        // take a slice from sorted transactions that begins at current index and goes until however many are left
        const slicedTransactions = sortedTransactions.slice(
          index,
          index + entriesLeft
        )
        // filter the transactions
        const missingTxIdHashes = slicedTransactions.filter(txidHash => {
          // remove any that do not have a file
          return !files[txidHash]
        })
        // load files into state
        const missingFiles = await loadTxFiles(input, missingTxIdHashes)
        Object.assign(files, missingFiles)
        // give txs the unfilteredIndex

        for (const txidHash of slicedTransactions) {
          const file = files[txidHash]
          if (file == null) continue
          const tempTx = txs[file.txid]
          // skip irrelevant transactions - txs that are not in the files (dropped)
          if (
            !tempTx ||
            (!tempTx.nativeAmount[currencyCode] &&
              !tempTx.networkFee[currencyCode])
          ) {
            // exit block if there is no transaction or no amount / no fee
            continue
          }
          const tx = {
            ...tempTx,
            unfilteredIndex: mappedUnfilteredIndexes[txidHash]
          }
          // add this tx / file to the output
          out.push(combineTxWithFile(input, tx, file, currencyCode))
        }
        // continue until the required tx number loaded
        const res = await getBulkTx(index + entriesLeft, out)
        return res
      }

      const out = await getBulkTx(startIndex)
      return out
    },

    async exportTransactionsToQBO(
      opts
    ) {
      const edgeTransactions = await this.getTransactions(
        opts
      )
      const currencyCode =
        opts && opts.currencyCode
          ? opts.currencyCode
          : input.props.selfState.currencyInfo.currencyCode
      const denom = opts && opts.denomination ? opts.denomination : null
      const qbo = exportTransactionsToQBOInner(
        edgeTransactions,
        currencyCode,
        this.fiatCurrencyCode,
        denom,
        Date.now()
      )
      return qbo
    },

    async exportTransactionsToCSV(
      opts
    ) {
      const edgeTransactions = await this.getTransactions(
        opts
      )
      const currencyCode =
        opts && opts.currencyCode
          ? opts.currencyCode
          : input.props.selfState.currencyInfo.currencyCode
      const denom = opts && opts.denomination ? opts.denomination : null
      const csv = await exportTransactionsToCSVInner(
        edgeTransactions,
        currencyCode,
        this.fiatCurrencyCode,
        denom
      )
      return csv
    },

    async getReceiveAddress(
      opts = {}
    ) {
      const freshAddress = engine.getFreshAddress(opts)
      const receiveAddress = {
        metadata: fakeMetadata,
        nativeAmount: '0',
        publicAddress: freshAddress.publicAddress,
        legacyAddress: freshAddress.legacyAddress,
        segwitAddress: freshAddress.segwitAddress
      }
      return receiveAddress
    },

    async saveReceiveAddress(
      receiveAddress
    ) {
      // TODO: Address metadata
    },

    async lockReceiveAddress(
      receiveAddress
    ) {
      // TODO: Address metadata
    },

    async makeSpend(spendInfo) {
      return engine.makeSpend(spendInfo)
    },

    async sweepPrivateKeys(spendInfo) {
      if (!engine.sweepPrivateKeys) {
        return Promise.reject(
          new Error('Sweeping this currency is not supported.')
        )
      }
      return engine.sweepPrivateKeys(spendInfo)
    },

    async signTx(tx) {
      return engine.signTx(tx)
    },

    async broadcastTx(tx) {
      return engine.broadcastTx(tx)
    },

    async saveTx(tx) {
      return engine.saveTx(tx)
    },

    async resyncBlockchain() {
      ai.props.dispatch({
        type: 'CURRENCY_ENGINE_CLEARED',
        payload: { walletId: input.props.id }
      })
      return engine.resyncBlockchain()
    },

    async dumpData() {
      return engine.dumpData()
    },

    async getPaymentProtocolInfo(
      paymentProtocolUrl
    ) {
      if (!engine.getPaymentProtocolInfo) {
        throw new Error(
          "'getPaymentProtocolInfo' is not implemented on wallets of this type"
        )
      }
      return engine.getPaymentProtocolInfo(paymentProtocolUrl)
    },

    async saveTxMetadata(
      txid,
      currencyCode,
      metadata
    ) {
      return setCurrencyWalletTxMetadata(
        input,
        txid,
        currencyCode,
        fixMetadata(metadata, input.props.selfState.fiat),
        fakeCallbacks
      )
    },

    async getMaxSpendable(spendInfo) {
      const { currencyCode, networkFeeOption, customNetworkFee } = spendInfo
      const balance = engine.getBalance({ currencyCode })

      // Copy all the spend targets, setting the amounts to 0
      // but keeping all other information so we can get accurate fees:
      const spendTargets = spendInfo.spendTargets.map(spendTarget => {
        return { ...spendTarget, nativeAmount: '0' }
      })

      // The range of possible values includes `min`, but not `max`.
      function getMax(min, max) {
        const diff = sub(max, min)
        if (lte(diff, '1')) {
          return Promise.resolve(min)
        }
        const mid = add(min, div(diff, '2'))

        // Try the average:
        spendTargets[0].nativeAmount = mid
        return engine
          .makeSpend({
            currencyCode,
            spendTargets,
            networkFeeOption,
            customNetworkFee
          })
          .then(good => getMax(mid, max))
          .catch(bad => getMax(min, mid))
      }

      return getMax('0', add(balance, '1'))
    },

    async parseUri(uri, currencyCode) {
      const tools = await getCurrencyTools(ai, walletInfo.type)
      return tools.parseUri(
        uri,
        currencyCode,
        input.props.state.currency.customTokens
      )
    },

    async encodeUri(obj) {
      const tools = await getCurrencyTools(ai, walletInfo.type)
      return tools.encodeUri(obj, input.props.state.currency.customTokens)
    },

    otherMethods,

    // Deprecated API's:
    getBalance: CurrencyWalletSync.prototype.getBalance,
    getBlockHeight: CurrencyWalletSync.prototype.getBlockHeight,
    getDisplayPrivateSeed: CurrencyWalletSync.prototype.getDisplayPrivateSeed,
    getDisplayPublicSeed: CurrencyWalletSync.prototype.getDisplayPublicSeed
  }
  bridgifyObject(out)

  return out
}

function fixMetadata(metadata, fiat) {
  const out = filterObject(metadata, [
    'bizId',
    'category',
    'exchangeAmount',
    'name',
    'notes'
  ])

  if (metadata.amountFiat != null) {
    if (out.exchangeAmount == null) out.exchangeAmount = {}
    out.exchangeAmount[fiat] = metadata.amountFiat
  }

  return out
}

export function combineTxWithFile(
  input,
  tx,
  file,
  currencyCode
) {
  const wallet = input.props.selfOutput.api
  const walletCurrency = input.props.selfState.currencyInfo.currencyCode
  const walletFiat = input.props.selfState.fiat

  const flowHack = tx
  const { unfilteredIndex } = flowHack

  // Copy the tx properties to the output:
  const out = {
    blockHeight: tx.blockHeight,
    date: tx.date,
    ourReceiveAddresses: tx.ourReceiveAddresses,
    signedTx: tx.signedTx,
    txid: tx.txid,
    otherParams: { ...tx.otherParams, unfilteredIndex },

    amountSatoshi: Number(tx.nativeAmount[currencyCode]),
    nativeAmount: tx.nativeAmount[currencyCode],
    networkFee: tx.networkFee[currencyCode],
    currencyCode,
    wallet
  }

  // These are our fallback values:
  const fallback = {
    providerFeeSent: 0,
    metadata: {
      name: '',
      category: '',
      notes: '',
      bizId: 0,
      amountFiat: 0,
      exchangeAmount: {}
    }
  }

  const merged = file
    ? mergeDeeply(
        fallback,
        file.currencies[walletCurrency],
        file.currencies[currencyCode]
      )
    : fallback

  if (file && file.creationDate < out.date) out.date = file.creationDate
  out.metadata = merged.metadata
  if (
    merged.metadata &&
    merged.metadata.exchangeAmount &&
    merged.metadata.exchangeAmount[walletFiat]
  ) {
    out.metadata.amountFiat = merged.metadata.exchangeAmount[walletFiat]
    if (out.metadata && out.metadata.amountFiat.toString().includes('e')) {
      // Corrupt amountFiat that exceeds a number that JS can cleanly represent without exponents. Set to 0
      out.metadata.amountFiat = 0
    }
  }

  return out
}
