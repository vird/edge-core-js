




/**
 * Determines whether or not a swap plugin is enabled,
 * with various fallbacks in case the settings are missing.
 */
export function swapPluginEnabled(
  swapSettings,
  pluginName
) {
  const { enabled = true } = swapSettings[pluginName] || {}
  return enabled
}
