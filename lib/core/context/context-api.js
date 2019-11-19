// 

import { bridgifyObject, onMethod, watchMethod } from 'yaob'

import { checkPasswordRules, fixUsername } from '../../client-side.js'









import { base58 } from '../../util/encoding.js'
import { findAppLogin, makeAccount } from '../account/account-init.js'
import { createLogin, usernameAvailable } from '../login/create.js'
import { requestEdgeLogin } from '../login/edge.js'
import { getStash } from '../login/login-selectors.js'
import {
  fetchLoginMessages,
  makeLoginTree,
  resetOtp,
  syncLogin
} from '../login/login.js'
import { removeStash } from '../login/loginStore.js'
import { loginPassword } from '../login/password.js'
import { getPin2Key, loginPin2 } from '../login/pin2.js'
import {
  getQuestions2,
  getRecovery2Key,
  listRecoveryQuestionChoices,
  loginRecovery2
} from '../login/recovery2.js'

import { EdgeInternalStuff } from './internal-api.js'

export function makeContextApi(ai) {
  const appId = ai.props.state.login.appId
  const $internalStuff = new EdgeInternalStuff(ai)
  let pauseTimer

  const out = {
    on: onMethod,
    watch: watchMethod,

    appId,

    async close() {
      ai.props.close()
    },

    $internalStuff,

    fixUsername,

    get localUsers() {
      return ai.props.state.login.localUsers
    },

    async listUsernames() {
      return Object.keys(ai.props.state.login.stashes)
    },

    async deleteLocalAccount(username) {
      // Safety check:
      const fixedName = fixUsername(username)
      for (const accountId of ai.props.state.accountIds) {
        if (ai.props.state.accounts[accountId].username === fixedName) {
          throw new Error('Cannot remove logged-in user')
        }
      }

      return removeStash(ai, username)
    },

    async usernameAvailable(username) {
      return usernameAvailable(ai, username)
    },

    async createAccount(
      username,
      password,
      pin,
      opts
    ) {
      return createLogin(ai, username, {
        password,
        pin
      }).then(loginTree => {
        return makeAccount(ai, appId, loginTree, 'newAccount', opts || {})
      })
    },

    async loginWithKey(
      username,
      loginKey,
      opts
    ) {
      const stashTree = getStash(ai, username)
      const loginTree = makeLoginTree(stashTree, base58.parse(loginKey), appId)

      // Since we logged in offline, update the stash in the background:
      syncLogin(ai, loginTree, findAppLogin(loginTree, appId)).catch(e =>
        ai.props.onError(e)
      )

      return makeAccount(ai, appId, loginTree, 'keyLogin', opts || {})
    },

    async loginWithPassword(
      username,
      password,
      opts
    ) {
      const { otp } = opts || {} // opts can be `null`

      return loginPassword(ai, username, password, otp).then(loginTree => {
        return makeAccount(ai, appId, loginTree, 'passwordLogin', opts || {})
      })
    },

    checkPasswordRules,

    async pinLoginEnabled(username) {
      const loginStash = getStash(ai, username)
      const pin2Key = getPin2Key(loginStash, appId)
      return pin2Key && pin2Key.pin2Key != null
    },

    async loginWithPIN(
      username,
      pin,
      opts
    ) {
      const { otp } = opts || {} // opts can be `null`

      return loginPin2(ai, appId, username, pin, otp).then(loginTree => {
        return makeAccount(ai, appId, loginTree, 'pinLogin', opts || {})
      })
    },

    async getRecovery2Key(username) {
      const loginStash = getStash(ai, username)
      const recovery2Key = getRecovery2Key(loginStash)
      if (recovery2Key == null) {
        throw new Error('No recovery key stored locally.')
      }
      return base58.stringify(recovery2Key)
    },

    async loginWithRecovery2(
      recovery2Key,
      username,
      answers,
      opts
    ) {
      const { otp } = opts || {} // opts can be `null`

      return loginRecovery2(
        ai,
        base58.parse(recovery2Key),
        username,
        answers,
        otp
      ).then(loginTree => {
        return makeAccount(ai, appId, loginTree, 'recoveryLogin', opts || {})
      })
    },

    async fetchRecovery2Questions(
      recovery2Key,
      username
    ) {
      return getQuestions2(ai, base58.parse(recovery2Key), username)
    },

    async listRecoveryQuestionChoices() {
      return listRecoveryQuestionChoices(ai)
    },

    async requestEdgeLogin(
      opts
    ) {
      return requestEdgeLogin(ai, appId, opts)
    },

    async requestOtpReset(
      username,
      otpResetToken
    ) {
      return resetOtp(ai, username, otpResetToken)
    },

    async fetchLoginMessages() {
      return fetchLoginMessages(ai)
    },

    get paused() {
      return ai.props.state.paused
    },

    async changePaused(paused, opts = {}) {
      const { secondsDelay = 0 } = opts

      // If a timer is already running, stop that:
      if (pauseTimer != null) {
        clearTimeout(pauseTimer)
        pauseTimer = undefined
      }

      // If the state is the same, do nothing:
      if (ai.props.state.paused === paused) return

      // Otherwise, make the change:
      if (secondsDelay === 0) {
        ai.props.dispatch({ type: 'PAUSE', payload: paused })
      } else {
        pauseTimer = setTimeout(() => {
          pauseTimer = undefined
          ai.props.dispatch({ type: 'PAUSE', payload: paused })
        }, secondsDelay * 1000)
      }
    },

    // Deprecated API's:
    pinExists(username) {
      return this.pinLoginEnabled(username)
    }
  }
  bridgifyObject(out)

  return out
}
