// 

import { base32 } from 'rfc4648'

import { fixOtpKey } from '../../util/crypto/hotp.js'
import { applyKit } from '../login/login.js'



export async function enableOtp(
  ai,
  accountId,
  otpTimeout
) {
  const { loginTree } = ai.props.state.accounts[accountId]

  const otpKey =
    loginTree.otpKey != null
      ? fixOtpKey(loginTree.otpKey)
      : base32.stringify(ai.props.io.random(10))

  const kit = {
    serverPath: '/v2/login/otp',
    server: {
      otpKey,
      otpTimeout
    },
    stash: {
      otpKey,
      otpResetDate: undefined,
      otpTimeout
    },
    login: {
      otpKey,
      otpResetDate: undefined,
      otpTimeout
    },
    loginId: loginTree.loginId
  }
  await applyKit(ai, loginTree, kit)
}

export async function disableOtp(ai, accountId) {
  const { loginTree } = ai.props.state.accounts[accountId]

  const kit = {
    serverMethod: 'DELETE',
    serverPath: '/v2/login/otp',
    stash: {
      otpKey: undefined,
      otpResetDate: undefined,
      otpTimeout: undefined
    },
    login: {
      otpKey: undefined,
      otpResetDate: undefined,
      otpTimeout: undefined
    },
    loginId: loginTree.loginId
  }
  await applyKit(ai, loginTree, kit)
}

export async function cancelOtpReset(ai, accountId) {
  const { loginTree } = ai.props.state.accounts[accountId]

  const kit = {
    serverPath: '/v2/login/otp',
    server: {
      otpTimeout: loginTree.otpTimeout,
      otpKey: loginTree.otpKey
    },
    stash: {
      otpResetDate: undefined
    },
    login: {
      otpResetDate: undefined
    },
    loginId: loginTree.loginId
  }
  await applyKit(ai, loginTree, kit)
}
