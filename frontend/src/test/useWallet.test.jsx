import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as freighterApi from '@stellar/freighter-api'

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  getAddress: vi.fn(),
  requestAccess: vi.fn(),
  signTransaction: vi.fn(),
  getNetwork: vi.fn(),
}))

describe('useWallet hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns disconnected state by default', async () => {
    const { useWalletContext } = await import('../contexts/WalletContext.jsx')
    const { result } = renderHook(() => useWalletContext())

    expect(result.current.connected).toBe(false)
    expect(result.current.publicKey).toBeNull()
  })

  it('connects successfully when Freighter is available on testnet', async () => {
    freighterApi.isConnected.mockResolvedValue(true)
    freighterApi.getNetwork.mockResolvedValue('TESTNET')
    freighterApi.requestAccess.mockResolvedValue(true)
    freighterApi.getAddress.mockResolvedValue('GBBMTQRZMKH4WFYNRBQHCNDRJJZPYDSE6JTRZTSHPQST6DQIE6VAJ6SG')

    const { useWalletContext } = await import('../contexts/WalletContext.jsx')
    const { result } = renderHook(() => useWalletContext())

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.connected).toBe(true)
    expect(result.current.publicKey).toBe('GBBMTQRZMKH4WFYNRBQHCNDRJJZPYDSE6JTRZTSHPQST6DQIE6VAJ6SG')
  })

  it('throws error when Freighter is not installed', async () => {
    freighterApi.isConnected.mockResolvedValue(false)

    const { useWalletContext } = await import('../contexts/WalletContext.jsx')
    const { result } = renderHook(() => useWalletContext())

    await act(async () => {
      try {
        await result.current.connect()
      } catch (e) {
        // expected
      }
    })

    expect(result.current.connected).toBe(false)
  })

  it('throws error when wallet is on wrong network', async () => {
    freighterApi.isConnected.mockResolvedValue(true)
    freighterApi.getNetwork.mockResolvedValue('PUBLIC')

    const { useWalletContext } = await import('../contexts/WalletContext.jsx')
    const { result } = renderHook(() => useWalletContext())

    await act(async () => {
      try {
        await result.current.connect()
      } catch (e) {
        // expected
      }
    })

    expect(result.current.connected).toBe(false)
  })
})
