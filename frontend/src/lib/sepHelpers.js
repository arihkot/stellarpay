import {
  Asset,
  Operation,
  TransactionBuilder,
  BASE_FEE,
} from '@stellar/stellar-sdk'
import { getHorizonClient, getNetworkPassphrase } from './stellarClient.js'
import {
  PUBLIC_ANCHOR_HOME_DOMAIN,
  PUBLIC_NETWORK_PASSPHRASE,
} from './constants.js'

async function getSep38Quote(sellAsset, buyAsset, sellAmount) {
  const url = new URL(`${PUBLIC_ANCHOR_HOME_DOMAIN}/sep38/quote`)
  url.searchParams.set('sell_asset', sellAsset)
  url.searchParams.set('buy_asset', buyAsset)
  url.searchParams.set('sell_amount', sellAmount)
  const response = await fetch(url.toString())
  if (!response.ok) throw new Error(`SEP-38 quote failed: ${response.status}`)
  return response.json()
}

async function getSep38Info() {
  const response = await fetch(`${PUBLIC_ANCHOR_HOME_DOMAIN}/sep38/info`)
  if (!response.ok) throw new Error(`SEP-38 info failed: ${response.status}`)
  return response.json()
}

async function authSep10(publicKey, signTransaction) {
  const response = await fetch(`${PUBLIC_ANCHOR_HOME_DOMAIN}/auth`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!response.ok) throw new Error(`SEP-10 auth challenge failed: ${response.status}`)
  const authData = await response.json()
  if (!authData.transaction) throw new Error('No transaction in SEP-10 challenge')

  const signedTx = await signTransaction(authData.transaction, {
    networkPassphrase: PUBLIC_NETWORK_PASSPHRASE,
  })

  const tokenResponse = await fetch(`${PUBLIC_ANCHOR_HOME_DOMAIN}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: signedTx }),
  })
  if (!tokenResponse.ok) throw new Error(`SEP-10 auth failed: ${tokenResponse.status}`)
  const tokenData = await tokenResponse.json()
  return tokenData.token
}

async function initiateSep24Withdrawal(authToken, assetCode, amount) {
  const response = await fetch(`${PUBLIC_ANCHOR_HOME_DOMAIN}/sep24/transactions/interactive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      asset_code: assetCode,
      type: 'withdrawal',
      amount: amount,
    }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(`SEP-24 withdrawal failed: ${err.error || response.status}`)
  }
  return response.json()
}

async function pollSep24Transaction(authToken, txId) {
  const response = await fetch(`${PUBLIC_ANCHOR_HOME_DOMAIN}/sep24/transaction?id=${txId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  })
  if (!response.ok) return { status: 'unknown' }
  return response.json()
}

async function executePathPayment(publicKey, signTransaction, sourceAsset, destAsset, sendAmount, destMin) {
  const horizon = getHorizonClient()
  const account = await horizon.loadAccount(publicKey)
  const networkPassphrase = PUBLIC_NETWORK_PASSPHRASE

  const sellParts = sourceAsset.split(':')
  const buyParts = destAsset.split(':')

  const sellAsset = sellParts[1]
    ? new Asset(sellParts[0], sellParts[1])
    : Asset.native()

  const buyAsset = buyParts[1]
    ? new Asset(buyParts[0], buyParts[1])
    : Asset.native()

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset: sellAsset,
        sendAmount: sendAmount,
        destination: publicKey,
        destAsset: buyAsset,
        destMin: destMin,
      }),
    )
    .setTimeout(30)
    .build()

  const signedTx = await signTransaction(tx.toXDR(), { networkPassphrase })
  const txResult = await horizon.submitTransaction(
    TransactionBuilder.fromXDR(signedTx, networkPassphrase),
  )
  return txResult
}

async function checkTrustline(publicKey, assetCode, assetIssuer) {
  try {
    const horizon = getHorizonClient()
    const account = await horizon.loadAccount(publicKey)
    const balances = account.balances || []
    return balances.some(
      (b) =>
        b.asset_type !== 'native' &&
        b.asset_code === assetCode &&
        b.asset_issuer === assetIssuer,
    )
  } catch {
    return false
  }
}

async function establishTrustline(publicKey, signTransaction, assetCode, assetIssuer) {
  const horizon = getHorizonClient()
  const account = await horizon.loadAccount(publicKey)

  const asset = new Asset(assetCode, assetIssuer)
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PUBLIC_NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.changeTrust({
        asset: asset,
        limit: '100000000000', // high limit
      }),
    )
    .setTimeout(30)
    .build()

  const signedTx = await signTransaction(tx.toXDR(), {
    networkPassphrase: PUBLIC_NETWORK_PASSPHRASE,
  })
  const result = await horizon.submitTransaction(
    TransactionBuilder.fromXDR(signedTx, PUBLIC_NETWORK_PASSPHRASE),
  )
  return result
}

export {
  getSep38Quote,
  getSep38Info,
  authSep10,
  initiateSep24Withdrawal,
  pollSep24Transaction,
  executePathPayment,
  checkTrustline,
  establishTrustline,
}
