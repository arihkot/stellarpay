const PUBLIC_RPC_URL = import.meta.env.VITE_PUBLIC_RPC_URL || 'https://soroban-testnet.stellar.org'
const PUBLIC_NETWORK_PASSPHRASE = import.meta.env.VITE_PUBLIC_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015'
const PUBLIC_CONTRACT_ID = import.meta.env.VITE_PUBLIC_CONTRACT_ID || ''
const PUBLIC_ANCHOR_HOME_DOMAIN = import.meta.env.VITE_PUBLIC_ANCHOR_HOME_DOMAIN || 'https://testanchor.stellar.org'
const PUBLIC_HORIZON_URL = import.meta.env.VITE_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org'
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
const STELLAR_EXPERT_TX = 'https://stellar.expert/explorer/testnet/tx'
const STELLAR_EXPERT_CONTRACT = 'https://stellar.expert/explorer/testnet/contract'

export {
  PUBLIC_RPC_URL,
  PUBLIC_NETWORK_PASSPHRASE,
  PUBLIC_CONTRACT_ID,
  PUBLIC_ANCHOR_HOME_DOMAIN,
  PUBLIC_HORIZON_URL,
  USDC_ISSUER,
  STELLAR_EXPERT_TX,
  STELLAR_EXPERT_CONTRACT,
}
