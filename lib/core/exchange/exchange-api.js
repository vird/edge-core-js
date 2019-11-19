// 

import { bridgifyObject, onMethod } from 'yaob'



import { getExchangeRate } from './exchange-selectors.js'

/**
 * Creates an unwrapped exchange cache API object.
 */
export function makeExchangeCache(ai) {
  /**
   * TODO: Once the user has an exchange-rate preference,
   * look that up and bias in favor of the preferred exchange.
   */
  function getPairCost(source, age, inverse) {
    // The age curve goes from 0 to 1, with 1 being infinitely old.
    // The curve reaches half way (0.5) at 30 seconds in:
    const ageCurve = age / (30 + age)

    return ageCurve + (inverse ? 1.1 : 1) // + 2 * isWrongExchange()
  }

  const out = {
    on: onMethod,

    async convertCurrency(
      fromCurrency,
      toCurrency,
      amount = 1
    ) {
      const rate = getExchangeRate(
        ai.props.state,
        fromCurrency,
        toCurrency,
        getPairCost
      )
      return amount * rate
    }
  }
  bridgifyObject(out)

  return out
}
