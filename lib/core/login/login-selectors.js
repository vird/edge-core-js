// 

import { fixUsername } from '../../client-side.js'

import { scrypt, userIdSnrp } from '../scrypt/scrypt-selectors.js'


export { fixUsername }

/**
 * Finds the login stash for the given username.
 * Returns a default object if
 */
export function getStash(ai, username) {
  const fixedName = fixUsername(username)
  const { stashes } = ai.props.state.login

  return stashes[fixedName] || { username: fixedName, appId: '' }
}

// Hashed username cache:
const userIdCache = {}

/**
 * Hashes a username into a userId.
 */
export function hashUsername(
  ai,
  username
) {
  const fixedName = fixUsername(username)
  if (userIdCache[fixedName] == null) {
    userIdCache[fixedName] = scrypt(ai, fixedName, userIdSnrp)
  }
  return userIdCache[fixedName]
}
