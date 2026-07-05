import {
  rpc,
  Horizon,
} from '@stellar/stellar-sdk'
import {
  PUBLIC_RPC_URL,
  PUBLIC_HORIZON_URL,
  PUBLIC_NETWORK_PASSPHRASE,
} from './constants.js'

let rpcClient = null
let horizonClient = null

function getRpcClient() {
  if (!rpcClient) {
    rpcClient = new rpc.Server(PUBLIC_RPC_URL)
  }
  return rpcClient
}

function getHorizonClient() {
  if (!horizonClient) {
    horizonClient = new Horizon.Server(PUBLIC_HORIZON_URL)
  }
  return horizonClient
}

function getNetworkPassphrase() {
  return PUBLIC_NETWORK_PASSPHRASE
}

export { getRpcClient, getHorizonClient, getNetworkPassphrase }
