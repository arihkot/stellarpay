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
  if (!response.ok) {
    throw new Error(`SEP-38 quote failed: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

async function getSep38Prices(sellAsset) {
  const url = new URL(`${PUBLIC_ANCHOR_HOME_DOMAIN}/sep38/prices`)
  url.searchParams.set('sell_asset', sellAsset)

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error(`SEP-38 prices failed: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

async function getSep38Info() {
  const url = `${PUBLIC_ANCHOR_HOME_DOMAIN}/sep38/info`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`SEP-38 info failed: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

async function authSep10(publicKey, signTransaction) {
  const response = await fetch(`${PUBLIC_ANCHOR_HOME_DOMAIN}/auth`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`SEP-10 auth challenge failed: ${response.status}`)
  }

  const authData = await response.json()
  if (!authData.transaction) {
    throw new Error('No transaction in SEP-10 challenge')
  }

  const signedTx = await signTransaction(authData.transaction, {
    networkPassphrase: PUBLIC_NETWORK_PASSPHRASE,
  })

  const tokenResponse = await fetch(`${PUBLIC_ANCHOR_HOME_DOMAIN}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: signedTx }),
  })

  if (!tokenResponse.ok) {
    throw new Error(`SEP-10 auth failed: ${tokenResponse.status}`)
  }

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
    throw new Error(`SEP-24 withdrawal initiation failed: ${err.error || response.status}`)
  }

  return response.json()
}

async function executePathPayment(publicKey, signTransaction, sourceAsset, destAsset, sendAmount, destMin) {
  const horizon = getHorizonClient()
  const account = await horizon.loadAccount(publicKey)
  const networkPassphrase = PUBLIC_NETWORK_PASSPHRASE

  const sellAssetParts = sourceAsset.split(':')
  const buyAssetParts = destAsset.split(':')

  const sellAsset = new Asset(sellAssetParts[0], sellAssetParts[1] || null)
  const buyAsset = new Asset(buyAssetParts[0], buyAssetParts[1] || null)

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

  const signedTx = await signTransaction(tx.toXDR(), { networkPassphrase: getNetworkPassphrase() })
  const txResult = await horizon.submitTransaction(
    TransactionBuilder.fromXDR(signedTx, networkPassphrase),
  )
  return txResult
}

export {
  getSep38Quote,
  getSep38Prices,
  getSep38Info,
  authSep10,
  initiateSep24Withdrawal,
  executePathPayment,
}
