// 

import { makeContext, makeFakeWorld } from './core/core.js'
import { makeBrowserIo } from './io/browser/browser-io.js'







export { makeBrowserIo }
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
  return makeContext(makeBrowserIo(), {}, opts)
}

export function makeFakeEdgeWorld(
  users = []
) {
  return Promise.resolve(makeFakeWorld(makeBrowserIo(), {}, users))
}
