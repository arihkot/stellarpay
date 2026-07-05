import { useState, useEffect, useCallback } from 'react'
import { useWalletContext } from '../contexts/WalletContext.jsx'
import { useContract } from '../hooks/useContract.js'
import { getUsdcBalance } from '../hooks/useWallet.js'

import CashOutFlow from './CashOutFlow.jsx'

export default function WorkerDashboard() {
  const { publicKey, connect } = useWalletContext()
  const contract = useContract()
  const [usdcBalance, setUsdcBalance] = useState(0)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCashOut, setShowCashOut] = useState(false)

  const loadWorkerData = useCallback(async () => {
    setLoading(true)
    try {
      const balance = await getUsdcBalance()
      setUsdcBalance(balance)

      try {
        const info = await contract.getWorkerInfo(
          'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', // dummy employer
          publicKey,
        )
        if (info && info.total_paid > 0) {
          setPayments([
            {
              amount: Number(info.total_paid) / 1e7,
              timestamp: new Date().toISOString(),
            },
          ])
        }
      } catch {
        // silently fail
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [publicKey, contract])

  useEffect(() => {
    if (publicKey) {
      loadWorkerData()
    }
  }, [loadWorkerData, publicKey])

  if (!publicKey) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center px-4">
        <h2 className="text-2xl font-bold mb-4">Worker Dashboard</h2>
        <p className="text-gray-400 mb-6">Connect Freighter to view your payments.</p>
        <button
          onClick={connect}
          className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
        >
          Connect Freighter
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Worker Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">USDC Balance</p>
          <p className="text-2xl font-bold">${usdcBalance.toFixed(2)}</p>
          <button
            onClick={() => setShowCashOut(true)}
            disabled={usdcBalance <= 0}
            className="mt-3 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors text-sm"
          >
            Cash Out
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">Total Received</p>
          <p className="text-2xl font-bold">
            ${payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading payment history...</p>
      ) : payments.length > 0 ? (
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Payment History</h3>
          <div className="space-y-3">
            {payments.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-700/50"
              >
                <div>
                  <p className="text-sm text-green-400">+${p.amount.toFixed(2)} USDC</p>
                  <p className="text-xs text-gray-500">
                    {new Date(p.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl p-6">
          <p className="text-sm text-gray-500">No payments received yet.</p>
        </div>
      )}

      {showCashOut && (
        <CashOutFlow
          usdcBalance={usdcBalance}
          onClose={() => setShowCashOut(false)}
        />
      )}
    </div>
  )
}
