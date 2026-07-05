import { useState, useEffect, useCallback } from 'react'
import {
  connectWallet,
  disconnectWallet,
  subscribe,
  getState,
} from '../hooks/useWallet.js'

export function useWalletContext() {
  const [state, setState] = useState(getState())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = subscribe((newState) => {
      setState(newState)
    })
    return unsubscribe
  }, [])

  const connect = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await connectWallet()
      setState(result)
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const disconnect = useCallback(async () => {
    await disconnectWallet()
  }, [])

  return {
    connected: state.connected,
    publicKey: state.publicKey,
    network: state.network,
    connect,
    disconnect,
    loading,
    error,
  }
}
