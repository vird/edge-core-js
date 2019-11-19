// 

import { navigateDisklet } from 'disklet'















const allPlugins = {}
let allPluginsLocked = false
const onPluginsAdded = []
const onPluginsLocked = []

/**
 * Adds plugins to the core.
 */
export function addEdgeCorePlugins(plugins) {
  if (allPluginsLocked) {
    throw new Error('The Edge core plugin list has already been locked')
  }

  // Save the new plugins:
  for (const pluginName in plugins) {
    allPlugins[pluginName] = plugins[pluginName]
  }

  // Update already-booted contexts:
  for (const f of onPluginsAdded) f(plugins)
}

/**
 * Finalizes the core plugin list, so no further plugins are expected.
 */
export function lockEdgeCorePlugins() {
  allPluginsLocked = true
  for (const f of onPluginsLocked) f()
}

/**
 * Subscribes a context object to the core plugin list.
 */
export function watchPlugins(
  io,
  nativeIo,
  pluginsInit,
  dispatch
) {
  const pluginsAdded = plugins => {
    const out = {}

    for (const pluginName in plugins) {
      const plugin = plugins[pluginName]
      const initOptions = pluginsInit[pluginName]
      if (!initOptions) continue

      // Figure out what kind of object this is:
      try {
        if (typeof plugin === 'function') {
          const opts = {
            initOptions: typeof initOptions === 'object' ? initOptions : {},
            io,
            nativeIo,
            pluginDisklet: navigateDisklet(io.disklet, 'plugins/' + pluginName)
          }
          out[pluginName] = plugin(opts)
        } else if (typeof plugin === 'object' && plugin != null) {
          out[pluginName] = plugin
        } else {
          throw new TypeError(
            `Plugins must be functions or objects, got ${typeof plugin}`
          )
        }
      } catch (error) {
        // Show the error but keep going:
        io.console.error(error)
      }
    }

    dispatch({ type: 'CORE_PLUGINS_ADDED', payload: out })
  }

  const pluginsLocked = () => {
    dispatch({ type: 'CORE_PLUGINS_LOCKED', payload: pluginsInit })
  }

  // Add any plugins currently available:
  pluginsAdded(allPlugins)
  if (allPluginsLocked) pluginsLocked()

  // Save the callbacks:
  onPluginsAdded.push(pluginsAdded)
  onPluginsLocked.push(pluginsLocked)

  return () => {
    onPluginsAdded.filter(f => f !== pluginsAdded)
    onPluginsLocked.filter(f => f !== pluginsLocked)
  }
}
