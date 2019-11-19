"use strict";Object.defineProperty(exports, "__esModule", {value: true});/*
 * These are errors the core knows about.
 *
 * The GUI should handle these errors in an "intelligent" way, such as by
 * displaying a localized error message or asking the user for more info.
 * All these errors have a `type` field, which the GUI can use to select
 * the appropriate response.
 *
 * Other errors are possible, of course, since the Javascript language
 * itself can generate exceptions. Those errors won't have a `type` field,
 * and the GUI should just show them with a stack trace & generic message,
 * since the program has basically crashed at that point.
 */

 const errorNames = {
  DustSpendError: 'DustSpendError',
  InsufficientFundsError: 'InsufficientFundsError',
  SpendToSelfError: 'SpendToSelfError',
  NetworkError: 'NetworkError',
  ObsoleteApiError: 'ObsoleteApiError',
  OtpError: 'OtpError',
  PasswordError: 'PasswordError',
  PendingFundsError: 'PendingFundsError',
  SameCurrencyError: 'SameCurrencyError',
  SwapAboveLimitError: 'SwapAboveLimitError',
  SwapBelowLimitError: 'SwapBelowLimitError',
  SwapCurrencyError: 'SwapCurrencyError',
  SwapPermissionError: 'SwapPermissionError',
  UsernameError: 'UsernameError',
  NoAmountSpecifiedError: 'NoAmountSpecifiedError'
}; exports.errorNames = errorNames

/**
 * Trying to spend an uneconomically small amount of money.
 */
 function DustSpendError(message = 'Please send a larger amount') {
  const e = new Error(message)
  e.name = exports.errorNames.DustSpendError
  return e
} exports.DustSpendError = DustSpendError;

/**
 * Trying to spend more money than the wallet contains.
 */
 function InsufficientFundsError(currencyCode) {
  let message
  if (currencyCode == null) {
    message = 'Insufficient funds'
  } else if (currencyCode.length > 5) {
    // Some plugins pass a message instead of a currency code:
    message = currencyCode
    currencyCode = undefined
  } else {
    message = `Insufficient ${currencyCode}`
  }

  const e = new Error(message)
  e.name = exports.errorNames.InsufficientFundsError
  if (currencyCode != null) e.currencyCode = currencyCode
  return e
} exports.InsufficientFundsError = InsufficientFundsError;

/**
 * Trying to spend to an address of the source wallet
 */
 function SpendToSelfError(message = 'Spending to self') {
  const e = new Error(message)
  e.name = exports.errorNames.SpendToSelfError
  return e
} exports.SpendToSelfError = SpendToSelfError;

/**
 * Attempting to create a MakeSpend without specifying an amount of currency to send
 */

 function NoAmountSpecifiedError(
  message = 'Unable to create zero-amount transaction.'
) {
  const e = new Error(message)
  e.name = exports.errorNames.NoAmountSpecifiedError
  return e
} exports.NoAmountSpecifiedError = NoAmountSpecifiedError;

/**
 * Could not reach the server at all.
 */
 function NetworkError(message = 'Cannot reach the network') {
  const e = new Error(message)
  e.name = e.type = exports.errorNames.NetworkError
  return e
} exports.NetworkError = NetworkError;

/**
 * The endpoint on the server is obsolete, and the app needs to be upgraded.
 */
 function ObsoleteApiError(
  message = 'The application is too old. Please upgrade.'
) {
  const e = new Error(message)
  e.name = e.type = exports.errorNames.ObsoleteApiError
  return e
} exports.ObsoleteApiError = ObsoleteApiError;

/**
 * The OTP token was missing / incorrect.
 *
 * The error object should include a `resetToken` member,
 * which can be used to reset OTP protection on the account.
 *
 * The error object may include a `resetDate` member,
 * which indicates that an OTP reset is already pending,
 * and when it will complete.
 */
 function OtpError(resultsJson = {}, message = 'Invalid OTP token') {
  const e = new Error(message)
  e.name = e.type = exports.errorNames.OtpError
  e.resetToken = resultsJson.otp_reset_auth
  if (resultsJson.otp_timeout_date != null) {
    // The server returns dates as ISO 8601 formatted strings:
    e.resetDate = new Date(resultsJson.otp_timeout_date)
  }
  return e
} exports.OtpError = OtpError;

/**
 * The provided authentication is incorrect.
 *
 * Reasons could include:
 * - Password login: wrong password
 * - PIN login: wrong PIN
 * - Recovery login: wrong answers
 *
 * The error object may include a `wait` member,
 * which is the number of seconds the user must wait before trying again.
 */
 function PasswordError(resultsJson = {}, message = 'Invalid password') {
  const e = new Error(message)
  e.name = e.type = exports.errorNames.PasswordError
  e.wait = resultsJson.wait_seconds
  return e
} exports.PasswordError = PasswordError;

/**
 * Trying to spend funds that are not yet confirmed.
 */
 function PendingFundsError(message = 'Not enough confirmed funds') {
  const e = new Error(message)
  e.name = exports.errorNames.PendingFundsError
  return e
} exports.PendingFundsError = PendingFundsError;

/**
 * Attempting to shape shift between two wallets of same currency.
 */
 function SameCurrencyError(
  message = 'Wallets can not be the same currency'
) {
  const e = new Error(message)
  e.name = exports.errorNames.SameCurrencyError
  return e
} exports.SameCurrencyError = SameCurrencyError;

/**
 * Trying to swap an amount that is either too low or too high.
 * @param nativeMax the maximum supported amount, in the "from" currency.
 */
 function SwapAboveLimitError(swapInfo, nativeMax) {
  const e = new Error('Amount is too high')
  e.name = exports.errorNames.SwapAboveLimitError
  e.pluginName = swapInfo.pluginName
  e.nativeMax = nativeMax
  return e
} exports.SwapAboveLimitError = SwapAboveLimitError;

/**
 * Trying to swap an amount that is either too low or too high.
 * @param nativeMin the minimum supported amount, in the "from" currency.
 */
 function SwapBelowLimitError(swapInfo, nativeMin) {
  const e = new Error('Amount is too low')
  e.name = exports.errorNames.SwapBelowLimitError
  e.pluginName = swapInfo.pluginName
  e.nativeMin = nativeMin
  return e
} exports.SwapBelowLimitError = SwapBelowLimitError;

/**
 * The swap plugin does not support this currency pair.
 */
 function SwapCurrencyError(swapInfo, fromCurrency, toCurrency) {
  const e = new Error(
    `${swapInfo.displayName} does not support ${fromCurrency} to ${toCurrency}`
  )
  e.name = exports.errorNames.SwapCurrencyError
  e.pluginName = swapInfo.pluginName
  e.fromCurrency = fromCurrency
  e.toCurrency = toCurrency
  return e
} exports.SwapCurrencyError = SwapCurrencyError;

/**
 * The user is not allowed to swap these coins for some reason
 * (no KYC, restricted IP address, etc...).
 * @param reason A string giving the reason for the denial.
 * - 'geoRestriction': The IP address is in a restricted region
 * - 'noVerification': The user needs to provide KYC credentials
 * - 'needsActivation': The user needs to log into the service.
 */
 function SwapPermissionError(swapInfo, reason) {
  const e = new Error(reason || 'You are not allowed to make this trade')
  e.name = exports.errorNames.SwapPermissionError
  e.pluginName = swapInfo.pluginName
  e.reason = reason
  return e
} exports.SwapPermissionError = SwapPermissionError;

/**
 * Cannot find a login with that id.
 *
 * Reasons could include:
 * - Password login: wrong username
 * - PIN login: wrong PIN key
 * - Recovery login: wrong username, or wrong recovery key
 */
 function UsernameError(message = 'Invalid username') {
  const e = new Error(message)
  e.name = e.type = exports.errorNames.UsernameError
  return e
} exports.UsernameError = UsernameError;
