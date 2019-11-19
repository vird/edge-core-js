// 

import { compose, createStore } from 'redux'
import { attachPixie, filterPixie } from 'redux-pixies'
import { emit } from 'yaob'








import { watchPlugins } from './plugins/plugins-actions.js'
import { rootPixie } from './root-pixie.js'
import { reducer } from './root-reducer.js'

let allContexts = []

const composeEnhancers =
  typeof window === 'object' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({ name: 'core' })
    : compose

/**
 * Creates the root object for the entire core state machine.
 * This core object contains the `io` object, context options,
 * Redux store, and tree of background workers.
 */
export async function makeContext(
  io,
  nativeIo,
  opts
) {
  const {
    apiKey,
    appId = '',
    authServer = 'https://auth.airbitz.co/api',
    hideKeys = false,
    plugins: pluginsInit = {}
  } = opts

  if (apiKey == null) {
    throw new Error('No API key provided')
  }

  // Load the login stashes from disk:
  const stashes = {}
  const listing = await io.disklet.list('logins')
  const files = Object.keys(listing).filter(path => listing[path] === 'file')
  for (const path of files) {
    try {
      stashes[path] = JSON.parse(await io.disklet.getText(path))
    } catch (e) {}
  }

  // Start Redux:
  const enhancers = composeEnhancers()
  const redux = createStore(reducer, enhancers)
  redux.dispatch({
    type: 'INIT',
    payload: { apiKey, appId, authServer, hideKeys, pluginsInit, stashes }
  })

  // Subscribe to new plugins:
  const closePlugins = watchPlugins(io, nativeIo, pluginsInit, redux.dispatch)

  // Start the pixie tree:
  const mirror = { output: {} }
  const closePixie = attachPixie(
    redux,
    filterPixie(
      rootPixie,
      (props) => ({
        ...props,
        close() {
          closePixie()
          closePlugins()
          redux.dispatch({ type: 'CLOSE' })
        },
        io,
        onError: error => {
          if (mirror.output.context && mirror.output.context.api) {
            emit(mirror.output.context.api, 'error', error)
          }
        }
      })
    ),
    e => console.error(e),
    output => (mirror.output = output)
  )

  const out = mirror.output.context.api
  allContexts.push(out)
  return out
}

/**
 * We use this for unit testing, to kill all core contexts.
 */
export function closeEdge() {
  for (const context of allContexts) context.close()
  allContexts = []
}
