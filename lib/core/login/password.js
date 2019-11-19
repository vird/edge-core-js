// 

import { base64 } from 'rfc4648'

import { decrypt, encrypt } from '../../util/crypto/crypto.js'
import { fixOtpKey, totp } from '../../util/crypto/hotp.js'

import { makeSnrp, scrypt, userIdSnrp } from '../scrypt/scrypt-selectors.js'
import { authRequest } from './authServer.js'
import { fixUsername, getStash, hashUsername } from './login-selectors.js'





import { applyKit, applyLoginReply, makeLoginTree, syncLogin } from './login.js'
import { saveStash } from './loginStore.js'

export const passwordAuthSnrp = userIdSnrp

function makeHashInput(username, password) {
  return fixUsername(username) + password
}

/**
 * Extracts the loginKey from the login stash.
 */
async function extractLoginKey(
  ai,
  stash,
  username,
  password
) {
  const { passwordBox, passwordKeySnrp } = stash
  if (passwordBox == null || passwordKeySnrp == null) {
    throw new Error('Missing data for offline password login')
  }
  const up = makeHashInput(username, password)
  const passwordKey = await scrypt(ai, up, passwordKeySnrp)
  return decrypt(passwordBox, passwordKey)
}

/**
 * Fetches the loginKey from the server.
 */
async function fetchLoginKey(
  ai,
  username,
  password,
  otp
) {
  const up = makeHashInput(username, password)

  const [userId, passwordAuth] = await Promise.all([
    hashUsername(ai, username),
    scrypt(ai, up, passwordAuthSnrp)
  ])
  const request = {
    userId: base64.stringify(userId),
    passwordAuth: base64.stringify(passwordAuth),
    otp
  }
  const reply = await authRequest(ai, 'POST', '/v2/login', request)
  if (reply.passwordBox == null || reply.passwordKeySnrp == null) {
    throw new Error('Missing data for online password login')
  }
  const passwordKey = await scrypt(ai, up, reply.passwordKeySnrp)
  return {
    loginKey: decrypt(reply.passwordBox, passwordKey),
    loginReply: reply
  }
}

/**
 * Logs a user in using a password.
 * @param username string
 * @param password string
 * @return A `Promise` for the new root login.
 */
export async function loginPassword(
  ai,
  username,
  password,
  otpKey
) {
  const { io } = ai.props
  let stashTree = getStash(ai, username)

  try {
    const loginKey = await extractLoginKey(ai, stashTree, username, password)
    const loginTree = makeLoginTree(stashTree, loginKey)

    // Since we logged in offline, update the stash in the background:
    // TODO: If the user provides an OTP token, add that to the stash.
    syncLogin(ai, loginTree, loginTree).catch(e => io.console.warn(e))

    return loginTree
  } catch (e) {
    const { loginKey, loginReply } = await fetchLoginKey(
      ai,
      username,
      password,
      totp(otpKey || stashTree.otpKey)
    )
    stashTree = applyLoginReply(stashTree, loginKey, loginReply)
    if (otpKey) stashTree.otpKey = fixOtpKey(otpKey)
    await saveStash(ai, stashTree)
    return makeLoginTree(stashTree, loginKey)
  }
}

export async function changePassword(
  ai,
  accountId,
  password
) {
  const { loginTree, username } = ai.props.state.accounts[accountId]

  const kit = await makePasswordKit(ai, loginTree, username, password)
  await applyKit(ai, loginTree, kit)
}

/**
 * Returns true if the given password is correct.
 */
export async function checkPassword(
  ai,
  login,
  password
) {
  const { username, passwordAuth } = login
  if (!username || !passwordAuth) return false

  // Derive passwordAuth:
  const up = makeHashInput(username, password)
  const newPasswordAuth = await scrypt(ai, up, passwordAuthSnrp)

  // Compare what we derived with what we have:
  for (let i = 0; i < passwordAuth.length; ++i) {
    if (newPasswordAuth[i] !== passwordAuth[i]) return false
  }

  return true
}

export async function deletePassword(ai, accountId) {
  const { loginTree } = ai.props.state.accounts[accountId]

  const kit = {
    serverMethod: 'DELETE',
    serverPath: '/v2/login/password',
    stash: {
      passwordAuthSnrp: undefined,
      passwordBox: undefined,
      passwordKeySnrp: undefined
    },
    login: {
      passwordAuthSnrp: undefined,
      passwordBox: undefined,
      passwordKeySnrp: undefined
    },
    loginId: loginTree.loginId
  }
  // Only remove `passwordAuth` if we have another way to get in:
  if (loginTree.loginAuth != null) {
    kit.stash.passwordAuthBox = undefined
    kit.login.passwordAuthBox = undefined
  }
  await applyKit(ai, loginTree, kit)
}

/**
 * Creates the data needed to attach a password to a login.
 */
export function makePasswordKit(
  ai,
  login,
  username,
  password
) {
  const up = makeHashInput(username, password)
  const { io } = ai.props

  // loginKey chain:
  const boxPromise = makeSnrp(ai).then(passwordKeySnrp => {
    return scrypt(ai, up, passwordKeySnrp).then(passwordKey => {
      const passwordBox = encrypt(io, login.loginKey, passwordKey)
      return { passwordKeySnrp, passwordBox }
    })
  })

  // authKey chain:
  const authPromise = scrypt(ai, up, passwordAuthSnrp).then(passwordAuth => {
    const passwordAuthBox = encrypt(io, passwordAuth, login.loginKey)
    return { passwordAuth, passwordAuthBox }
  })

  return Promise.all([boxPromise, authPromise]).then(values => {
    const [
      { passwordKeySnrp, passwordBox },
      { passwordAuth, passwordAuthBox }
    ] = values
    return {
      serverPath: '/v2/login/password',
      server: {
        passwordAuth: base64.stringify(passwordAuth),
        passwordAuthSnrp, // TODO: Use this on the other side
        passwordKeySnrp,
        passwordBox,
        passwordAuthBox
      },
      stash: {
        passwordKeySnrp,
        passwordBox,
        passwordAuthBox
      },
      login: {
        passwordAuth
      },
      loginId: login.loginId
    }
  })
}
