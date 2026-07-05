import {
  isConnected,
  getAddress,
  requestAccess,
  signTransaction,
  getNetwork,
} from '@stellar/freighter-api'
import { PUBLIC_NETWORK_PASSPHRASE } from '../lib/constants.js'

let walletState = {
  connected: false,
  publicKey: null,
  network: null,
  networkPassphrase: null,
}

let listeners = []

function notifyListeners() {
  listeners.forEach((fn) => fn({ ...walletState }))
}

export function subscribe(callback) {
  listeners.push(callback)
  callback({ ...walletState })
  return () => {
    listeners = listeners.filter((fn) => fn !== callback)
  }
}

export function getState() {
  return { ...walletState }
}

export async function connectWallet() {
  try {
    const connResult = await isConnected()
    const isWalletConnected = connResult?.isConnected ?? connResult
    if (!isWalletConnected) {
      throw new Error('Freighter is not connected')
    }

    const networkObj = await getNetwork()
    const networkName = networkObj?.network || networkObj || ''
    if (!networkName.includes('TESTNET') && networkName !== 'FUTURENET') {
      throw new Error(`Wrong network: ${networkName}. Please switch to Testnet.`)
    }

    await requestAccess()
    const addrResult = await getAddress()
    const publicKey = addrResult?.address || addrResult || ''
    if (!publicKey) {
      throw new Error('Failed to get wallet address')
    }

    walletState = {
      connected: true,
      publicKey,
      network: networkName,
      networkPassphrase: PUBLIC_NETWORK_PASSPHRASE,
    }

    notifyListeners()
    return walletState
  } catch (err) {
    walletState = {
      connected: false,
      publicKey: null,
      network: null,
      networkPassphrase: null,
    }
    notifyListeners()
    throw err
  }
}

export async function disconnectWallet() {
  walletState = {
    connected: false,
    publicKey: null,
    network: null,
    networkPassphrase: null,
  }
  notifyListeners()
}

export function getPublicKey() {
  return walletState.publicKey
}

export function isWalletConnected() {
  return walletState.connected
}

export function getNetworkInfo() {
  return { network: walletState.network, passphrase: walletState.networkPassphrase }
}

export async function signTx(transactionXDR, opts = {}) {
  try {
    const result = await signTransaction(transactionXDR, {
      networkPassphrase: opts.networkPassphrase || PUBLIC_NETWORK_PASSPHRASE,
    })
    return result?.signedTxXdr || result
  } catch (err) {
    throw new Error(`Failed to sign transaction: ${err.message}`)
  }
}

export async function getBalances() {
  const publicKey = walletState.publicKey
  if (!publicKey) return []

  try {
    const response = await fetch(
      `https://horizon-testnet.stellar.org/accounts/${publicKey}`,
    )
    if (!response.ok) return []
    const data = await response.json()
    return data.balances || []
  } catch {
    return []
  }
}

export async function getUsdcBalance() {
  const balances = await getBalances()
  const usdcBalance = balances.find(
    (b) =>
      b.asset_type !== 'native' &&
      b.asset_code === 'USDC' &&
      b.asset_issuer === 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  )
  return usdcBalance ? parseFloat(usdcBalance.balance) : 0
}
