// 

import { combinePixies, mapPixie } from 'redux-pixies'


import {


  walletPixie
} from './wallet/currency-wallet-pixie.js'





export const currency = combinePixies({
  wallets: mapPixie(
    walletPixie,
    (props) => props.state.currency.currencyWalletIds,
    (props, id) => ({
      ...props,
      id,
      selfState: props.state.currency.wallets[id],
      selfOutput: props.output.currency.wallets[id]
    })
  )
})
