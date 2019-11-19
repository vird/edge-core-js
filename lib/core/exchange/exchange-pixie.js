// 

import { filterPixie } from 'redux-pixies'





export const exchange = filterPixie(
  (input) => {
    let started = false
    let stopped = false
    let timeout // Infer the proper timer type

    function gatherHints() {
      // TODO: Grab this off the list of loaded wallet currency types & fiats:
      return [
        { fromCurrency: 'BTC', toCurrency: 'iso:EUR' },
        { fromCurrency: 'BTC', toCurrency: 'iso:USD' },
        { fromCurrency: 'ETH', toCurrency: 'iso:EUR' },
        { fromCurrency: 'ETH', toCurrency: 'iso:USD' }
      ]
    }

    function dispatchPairs(pairs, source) {
      input.props.io.console.info(`Exchange rates updated (${source})`)
      if (pairs.length > 0) {
        input.props.dispatch({
          type: 'EXCHANGE_PAIRS_FETCHED',
          payload: pairs
        })
      }
    }

    function doFetch() {
      // Quit early if there is nothing to do:
      const pluginNames = Object.keys(input.props.state.plugins.rate)
      if (pluginNames.length === 0) return

      const hintPairs = gatherHints()

      // Gather pairs for up to five seconds, then send what we have:
      let wait = true
      let waitingPairs = []
      function sendWaitingPairs(done) {
        wait = false
        dispatchPairs(waitingPairs, done ? 'complete' : 'some pending')
      }
      const waitTimeout = setTimeout(sendWaitingPairs, 5000)

      // Initiate all requests:
      let finishedPairs = 0
      const timestamp = Date.now() / 1000
      const promises = pluginNames.map(pluginName => {
        const plugin = input.props.state.plugins.rate[pluginName]
        return fetchPluginRates(plugin, hintPairs, pluginName, timestamp)
          .then(pairs => {
            if (wait) waitingPairs = [...waitingPairs, ...pairs]
            else dispatchPairs(pairs, pluginName)
          })
          .catch(error => {
            input.props.io.console.info(
              `Rate provider ${pluginName} failed: ${String(error)}`
            )
          })
          .then(() => {
            // There is no need to keep waiting if all plugins are done:
            if (wait && ++finishedPairs >= pluginNames.length) {
              clearTimeout(waitTimeout)
              sendWaitingPairs(true)
            }
          })
      })

      // Wait for everyone to finish before doing another round:
      Promise.all(promises).then(() => {
        if (!stopped) timeout = setTimeout(doFetch, 30 * 1000)
      })
    }

    return {
      update(props) {
        // Kick off the initial fetch if we don't already have one running
        // and the plugins are ready:
        if (!started && props.state.plugins.locked) {
          started = true
          doFetch()
        }
      },

      destroy() {
        stopped = true
        if (timeout != null) clearTimeout(timeout)
      }
    }
  },
  props => (props.state.paused ? undefined : props)
)

/**
 * Fetching exchange rates can fail in exciting ways,
 * so performs a fetch with maximum paranoia.
 */
function fetchPluginRates(
  plugin,
  hintPairs,
  source,
  timestamp
) {
  try {
    return plugin.fetchRates(hintPairs).then(pairs =>
      pairs.map(pair => {
        const { fromCurrency, toCurrency, rate } = pair
        if (
          typeof fromCurrency !== 'string' ||
          typeof toCurrency !== 'string' ||
          typeof rate !== 'number'
        ) {
          throw new TypeError('Invalid data format')
        }
        return {
          fromCurrency,
          toCurrency,
          rate,
          source,
          timestamp
        }
      })
    )
  } catch (error) {
    return Promise.reject(error)
  }
}
