// 

import { mapFiles, mapFolders } from 'disklet'
import { bridgifyObject } from 'yaob'



import {
  getStorageWalletFolder,
  hashStorageWalletFilename
} from '../storage/storage-selectors.js'

function getPluginsFolder(ai, accountWalletInfo) {
  const folder = getStorageWalletFolder(ai.props.state, accountWalletInfo.id)
  return folder.folder('Plugins')
}

function getPluginFolder(ai, accountWalletInfo, storeId) {
  const folder = getPluginsFolder(ai, accountWalletInfo)
  return folder.folder(
    hashStorageWalletFilename(ai.props.state, accountWalletInfo.id, storeId)
  )
}

function getPluginFile(ai, accountWalletInfo, storeId, itemId) {
  const folder = getPluginFolder(ai, accountWalletInfo, storeId)
  return folder.file(
    hashStorageWalletFilename(ai.props.state, accountWalletInfo.id, itemId) +
      '.json'
  )
}

export function makeDataStoreApi(
  ai,
  accountId
) {
  const { accountWalletInfo } = ai.props.state.accounts[accountId]

  const out = {
    async deleteItem(storeId, itemId) {
      const file = getPluginFile(ai, accountWalletInfo, storeId, itemId)
      await file.delete()
    },

    async deleteStore(storeId) {
      const folder = getPluginFolder(ai, accountWalletInfo, storeId)
      await folder.delete()
    },

    async listItemIds(storeId) {
      const folder = getPluginFolder(ai, accountWalletInfo, storeId)

      const itemIds = await mapFiles(folder, file =>
        file
          .getText()
          .then(text => JSON.parse(text).key)
          .catch(e => undefined)
      )
      return itemIds.filter(itemId => typeof itemId === 'string')
    },

    async listStoreIds() {
      const folder = getPluginsFolder(ai, accountWalletInfo)

      const storeIds = await mapFolders(folder, folder =>
        folder
          .file('Name.json')
          .getText()
          .then(text => JSON.parse(text).name)
          .catch(e => undefined)
      )
      return storeIds.filter(storeId => typeof storeId === 'string')
    },

    async getItem(storeId, itemId) {
      const file = getPluginFile(ai, accountWalletInfo, storeId, itemId)
      const text = await file.getText()
      return JSON.parse(text).data
    },

    async setItem(
      storeId,
      itemId,
      value
    ) {
      // Set up the plugin folder, if needed:
      const folder = getPluginFolder(ai, accountWalletInfo, storeId)
      const storeIdFile = folder.file('Name.json')
      try {
        const text = await storeIdFile.getText()
        if (JSON.parse(text).name !== storeId) {
          throw new Error(`Warning: folder name doesn't match for ${storeId}`)
        }
      } catch (e) {
        await storeIdFile.setText(JSON.stringify({ name: storeId }))
      }

      // Set up the actual item:
      const file = getPluginFile(ai, accountWalletInfo, storeId, itemId)
      await file.setText(JSON.stringify({ key: itemId, data: value }))
    }
  }
  bridgifyObject(out)

  return out
}

export function makePluginDataApi(dataStore) {
  const out = {
    deleteItem(pluginId, itemId) {
      return dataStore.deleteItem(pluginId, itemId)
    },

    deletePlugin(pluginId) {
      return dataStore.deleteStore(pluginId)
    },

    listItemIds(pluginId) {
      return dataStore.listItemIds(pluginId)
    },

    listPluginIds() {
      return dataStore.listStoreIds()
    },

    getItem(pluginId, itemId) {
      return dataStore.getItem(pluginId, itemId)
    },

    setItem(pluginId, itemId, value) {
      return dataStore.setItem(pluginId, itemId, value)
    }
  }
  bridgifyObject(out)

  return out
}
