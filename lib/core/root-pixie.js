


import { combinePixies } from 'redux-pixies'


import { accounts } from './account/account-pixie.js'

import { context } from './context/context-pixie.js'
import { currency } from './currency/currency-pixie.js'
import { exchange } from './exchange/exchange-pixie.js'

import { scrypt } from './scrypt/scrypt-pixie.js'

// The top-level pixie output structure:



















export const rootPixie = combinePixies({
  accounts,
  context,
  currency,
  exchange,
  scrypt
})
