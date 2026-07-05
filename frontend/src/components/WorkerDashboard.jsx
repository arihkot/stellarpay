import { useState, useEffect, useCallback } from 'react'
import { useWalletContext } from '../contexts/WalletContext.jsx'
import { useContract } from '../hooks/useContract.js'
import { getBalances } from '../hooks/useWallet.js'
import { getHorizonClient } from '../lib/stellarClient.js'
import { USDC_ISSUER, STELLAR_EXPERT_TX } from '../lib/constants.js'
import { checkTrustline, establishTrustline } from '../lib/sepHelpers.js'
import { signTx } from '../hooks/useWallet.js'
import CashOutFlow from './CashOutFlow.jsx'

export default function WorkerDashboard() {
  const { publicKey, connect } = useWalletContext()
  const contract = useContract()
  const [usdcBalance, setUsdcBalance] = useState(0)
  const [xlmBalance, setXlmBalance] = useState(0)
  const [hasTrustline, setHasTrustline] = useState(true)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCashOut, setShowCashOut] = useState(false)
  const [settingTrustline, setSettingTrustline] = useState(false)

  const loadWorkerData = useCallback(async () => {
    setLoading(true)
    try {
      const balances = await getBalances()

      const native = balances.find((b) => b.asset_type === 'native')
      setXlmBalance(native ? parseFloat(native.balance) : 0)

      const usdc = balances.find(
        (b) =>
          b.asset_type !== 'native' &&
          b.asset_code === 'USDC' &&
          b.asset_issuer === USDC_ISSUER,
      )
      setUsdcBalance(usdc ? parseFloat(usdc.balance) : 0)
      setHasTrustline(!!usdc)

      await loadPaymentHistory()
    } catch {
      setLoading(false)
    }
  }, [publicKey])

  async function loadPaymentHistory() {
    try {
      const horizon = getHorizonClient()
      const txs = await horizon
        .transactions()
        .forAccount(publicKey)
        .limit(20)
        .order('desc')
        .call()

      const paymentList = []
      for (const tx of txs.records || []) {
        try {
          const ops = await horizon.operations().forTransaction(tx.id).call()
          for (const op of ops.records || []) {
            if (op.type === 'payment' && op.to === publicKey && op.asset_code === 'USDC') {
              paymentList.push({
                amount: parseFloat(op.amount),
                timestamp: tx.created_at,
                txHash: tx.id,
                from: op.from,
              })
            }
            if (op.type === 'path_payment_strict_send' && op.to === publicKey) {
              if (op.asset_code) {
                paymentList.push({
                  amount: parseFloat(op.amount),
                  timestamp: tx.created_at,
                  txHash: tx.id,
                  from: op.from,
                  sourceAsset: op.source_asset_code,
                })
              }
            }
          }
        } catch {
          // skip errors for individual txs
        }
      }

      setPayments(paymentList)
    } catch {
      // ignore errors
    } finally {
      setLoading(false)
    }
  }

  async function handleEstablishTrustline() {
    setSettingTrustline(true)
    try {
      await establishTrustline(publicKey, signTx, 'USDC', USDC_ISSUER)
      setHasTrustline(true)
      await loadWorkerData()
    } catch (err) {
      alert('Failed to establish trustline: ' + err.message)
    } finally {
      setSettingTrustline(false)
    }
  }

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

      {parseFloat(xlmBalance) < 1.5 && (
        <div className="mb-6 p-4 rounded-lg bg-yellow-900/20 border border-yellow-800">
          <p className="text-sm text-yellow-400">
            Low XLM balance ({parseFloat(xlmBalance).toFixed(2)} XLM). You need at least 1.5 XLM for transaction fees.
          </p>
          <a
            href="https://friendbot.stellar.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
          >
            Fund via Friendbot
          </a>
        </div>
      )}

      {!hasTrustline && (
        <div className="mb-6 p-4 rounded-lg bg-blue-900/20 border border-blue-800">
          <p className="text-sm text-blue-400">You don&apos;t have a USDC trustline yet.</p>
          <button
            onClick={handleEstablishTrustline}
            disabled={settingTrustline}
            className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors text-sm"
          >
            {settingTrustline ? 'Setting up...' : 'Establish USDC Trustline'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">USDC Balance</p>
          <p className="text-2xl font-bold">${usdcBalance.toFixed(2)}</p>
          <button
            onClick={() => setShowCashOut(true)}
            disabled={usdcBalance <= 0 || !hasTrustline}
            className="mt-3 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors text-sm"
          >
            Cash Out
          </button>
        </div>

        <div className="bg-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">XLM Balance</p>
          <p className="text-2xl font-bold">{parseFloat(xlmBalance).toFixed(2)} XLM</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">Total Received</p>
          <p className="text-2xl font-bold">
            ${payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm mt-3">Loading payment history...</p>
        </div>
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
                  <p className="text-sm text-green-400">
                    +${p.amount.toFixed(2)} {p.sourceAsset ? `${p.sourceAsset}/` : ''}USDC
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(p.timestamp).toLocaleString()}
                  </p>
                </div>
                {p.txHash && (
                  <a
                    href={`${STELLAR_EXPERT_TX}/${p.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl p-6">
          <p className="text-sm text-gray-500">No payments received yet.</p>
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={loadWorkerData}
          className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm"
        >
          Refresh
        </button>
      </div>

      {showCashOut && (
        <CashOutFlow
          usdcBalance={usdcBalance}
          onClose={() => setShowCashOut(false)}
        />
      )}
    </div>
  )
}
