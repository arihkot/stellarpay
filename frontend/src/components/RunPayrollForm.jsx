import { useState } from 'react'
import { STELLAR_EXPERT_TX } from '../lib/constants.js'

export default function RunPayrollForm({ publicKey, contract, poolBalance, onSuccess }) {
  const [payouts, setPayouts] = useState([{ address: '', amount: '' }])
  const [result, setResult] = useState(null)

  function addPayoutRow() {
    setPayouts([...payouts, { address: '', amount: '' }])
  }

  function removePayoutRow(index) {
    if (payouts.length === 1) return
    setPayouts(payouts.filter((_, i) => i !== index))
  }

  function updatePayout(index, field, value) {
    const updated = payouts.map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    )
    setPayouts(updated)
  }

  function validatePayouts() {
    const addresses = new Set()
    for (const p of payouts) {
      if (!p.address || !p.amount) return 'All fields are required'
      if (parseFloat(p.amount) <= 0) return 'Amounts must be positive'
      if (addresses.has(p.address)) return 'Duplicate worker addresses'
      addresses.add(p.address)
    }
    const total = payouts.reduce((sum, p) => sum + parseFloat(p.amount), 0)
    if (total > poolBalance) return `Total (${total}) exceeds pool balance (${poolBalance})`
    return null
  }

  async function handleRunPayroll() {
    const error = validatePayouts()
    if (error) {
      alert(error)
      return
    }

    try {
      const formattedPayouts = payouts.map((p) => ({
        address: p.address,
        amount: Math.floor(parseFloat(p.amount) * 1e7),
      }))

      const txResult = await contract.runPayroll(publicKey, formattedPayouts)

      if (txResult?.hash) {
        setResult({
          success: true,
          txHash: txResult.hash,
          workerCount: payouts.length,
          totalAmount: payouts.reduce((sum, p) => sum + parseFloat(p.amount), 0),
        })
      }

      onSuccess?.()
    } catch (err) {
      setResult({ success: false, error: err.message })
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-4">Run Payroll</h3>
      <p className="text-sm text-gray-400 mb-4">
        Pool Balance: ${poolBalance.toFixed(2)} USDC
      </p>

      <div className="space-y-3 mb-4">
        {payouts.map((p, idx) => (
          <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start">
            <input
              type="text"
              value={p.address}
              onChange={(e) => updatePayout(idx, 'address', e.target.value)}
              placeholder="Worker address (G...)"
              className="flex-1 px-3 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 text-sm font-mono"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={p.amount}
                onChange={(e) => updatePayout(idx, 'amount', e.target.value)}
                placeholder="USDC"
                step="0.01"
                min="0"
                className="w-28 px-3 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
              />
              {payouts.length > 1 && (
                <button
                  onClick={() => removePayoutRow(idx)}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-900/30 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={addPayoutRow}
          className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-sm"
        >
          + Add Worker
        </button>
        <button
          onClick={handleRunPayroll}
          disabled={contract.loading}
          className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors text-sm"
        >
          {contract.loading ? 'Processing...' : 'Run Payroll'}
        </button>
      </div>

      {contract.error && (
        <p className="mt-3 text-sm text-red-400">{contract.error}</p>
      )}

      {result?.success && (
        <div className="mt-4 p-4 rounded-lg bg-green-900/30 border border-green-800">
          <p className="text-sm text-green-400">
            Payroll sent to {result.workerCount} workers (${result.totalAmount.toFixed(2)} USDC)
          </p>
          <a
            href={`${STELLAR_EXPERT_TX}/${result.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
          >
            View on StellarExpert
          </a>
        </div>
      )}
      {result?.success === false && (
        <div className="mt-4 p-4 rounded-lg bg-red-900/30 border border-red-800">
          <p className="text-sm text-red-400">{result.error}</p>
        </div>
      )}
    </div>
  )
}
