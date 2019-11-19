// 

import { makeLocalBridge } from 'yaob'

import { makeContext, makeFakeWorld } from './core/core.js'
import { makeNodeIo } from './io/node/node-io.js'







export { makeNodeIo }
export {
  addEdgeCorePlugins,
  closeEdge,
  lockEdgeCorePlugins,
  makeFakeIo
} from './core/core.js'
export * from './types/types.js'

export function makeEdgeContext(
  opts
) {
  const { path = './edge' } = opts
  return makeContext(makeNodeIo(path), {}, opts)
}

export function makeFakeEdgeWorld(
  users = []
) {
  return Promise.resolve(
    makeLocalBridge(makeFakeWorld(makeNodeIo('.'), {}, users), {
      cloneMessage: message => JSON.parse(JSON.stringify(message))
    })
  )
}
