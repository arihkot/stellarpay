import { useState, useEffect, useCallback } from 'react'
import { useWalletContext } from '../contexts/WalletContext.jsx'
import { useContract } from '../hooks/useContract.js'
import { STELLAR_EXPERT_TX } from '../lib/constants.js'
import { getBalances } from '../hooks/useWallet.js'
import { USDC_ISSUER } from '../lib/constants.js'
import { checkTrustline, establishTrustline } from '../lib/sepHelpers.js'
import { signTx } from '../hooks/useWallet.js'
import WorkerList from './WorkerList.jsx'
import RunPayrollForm from './RunPayrollForm.jsx'
import PayrollRunHistory from './PayrollRunHistory.jsx'

export default function EmployerDashboard() {
  const { publicKey, connect } = useWalletContext()
  const contract = useContract()
  const [poolBalance, setPoolBalance] = useState(0)
  const [workerCount, setWorkerCount] = useState(0)
  const [usdcBalance, setUsdcBalance] = useState(0)
  const [xlmBalance, setXlmBalance] = useState(0)
  const [hasTrustline, setHasTrustline] = useState(true)
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [adminAddress, setAdminAddress] = useState('')
  const [fundAmount, setFundAmount] = useState('')
  const [activeTab, setActiveTab] = useState('workers')
  const [settingTrustline, setSettingTrustline] = useState(false)

  const loadEmployerData = useCallback(async () => {
    try {
      const balances = await getBalances()

      const native = balances.find((b) => b.asset_type === 'native')
      setXlmBalance(native ? parseFloat(native.balance) : 0)

      const usdc = balances.find(
        (b) => b.asset_type !== 'native' && b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER,
      )
      setUsdcBalance(usdc ? parseFloat(usdc.balance) : 0)
      setHasTrustline(!!usdc)

      const info = await contract.getEmployerInfo(publicKey)
      setPoolBalance(Number(info.pool_balance) / 1e7)
      setWorkerCount(info.worker_count || 0)
    } catch (_err) {
      // silently fail on first load
    }
  }, [publicKey, contract])

  useEffect(() => {
    if (publicKey) {
      loadEmployerData()
    }
  }, [loadEmployerData, publicKey])

  async function handleRegister() {
    try {
      await contract.registerEmployer(publicKey, adminAddress)
      await loadEmployerData()
      setShowRegisterForm(false)
    } catch (err) {
      alert(`Registration failed: ${err.message}`)
    }
  }

  async function handleFund() {
    try {
      const amount = parseFloat(fundAmount)
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount')
        return
      }
      await contract.fundPool(publicKey, amount)
      setFundAmount('')
      await loadEmployerData()
    } catch (err) {
      alert(`Funding failed: ${err.message}`)
    }
  }

  async function handleEstablishTrustline() {
    setSettingTrustline(true)
    try {
      await establishTrustline(publicKey, signTx, 'USDC', USDC_ISSUER)
      setHasTrustline(true)
      await loadEmployerData()
    } catch (err) {
      alert('Failed to establish trustline: ' + err.message)
    } finally {
      setSettingTrustline(false)
    }
  }

  if (!publicKey) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center px-4">
        <h2 className="text-2xl font-bold mb-4">Employer Dashboard</h2>
        <p className="text-gray-400 mb-6">Connect your Freighter wallet to manage payroll.</p>
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
      <h1 className="text-2xl font-bold mb-6">Employer Dashboard</h1>

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
          <p className="text-sm text-blue-400">You don&apos;t have a USDC trustline yet. This is needed for payments.</p>
          <button
            onClick={handleEstablishTrustline}
            disabled={settingTrustline}
            className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors text-sm"
          >
            {settingTrustline ? 'Setting up...' : 'Establish USDC Trustline'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">Pool Balance</p>
          <p className="text-2xl font-bold">${poolBalance.toFixed(2)} USDC</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">Workers</p>
          <p className="text-2xl font-bold">{workerCount}</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">USDC Wallet</p>
          <p className="text-2xl font-bold">${usdcBalance.toFixed(2)}</p>
        </div>
        {contract.lastTxHash && (
          <div className="bg-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">Last Tx</p>
            <a
              href={`${STELLAR_EXPERT_TX}/${contract.lastTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 truncate block"
            >
              {contract.lastTxHash.slice(0, 12)}...
            </a>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mb-8">
        {!showRegisterForm && (
          <button
            onClick={() => setShowRegisterForm(true)}
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm"
          >
            Register as Employer
          </button>
        )}
        <button
          onClick={loadEmployerData}
          className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm"
          disabled={contract.loading}
        >
          {contract.loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {showRegisterForm && (
        <div className="bg-gray-800 rounded-xl p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Register as Employer</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={adminAddress}
              onChange={(e) => setAdminAddress(e.target.value)}
              placeholder="Admin address"
              className="flex-1 px-3 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
            />
            <button
              onClick={handleRegister}
              disabled={contract.loading || !adminAddress}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors text-sm"
            >
              Register
            </button>
            <button
              onClick={() => setShowRegisterForm(false)}
              className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Fund Pool</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="number"
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
            placeholder="Amount in USDC"
            step="0.01"
            min="0"
            className="flex-1 px-3 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 text-sm"
          />
          <button
            onClick={handleFund}
            disabled={contract.loading || !fundAmount}
            className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-50 transition-colors text-sm"
          >
            {contract.loading ? 'Funding...' : 'Fund Pool'}
          </button>
        </div>
        {contract.error && (
          <p className="mt-3 text-sm text-red-400">{contract.error}</p>
        )}
      </div>

      <div className="mb-6">
        <div className="flex gap-1 border-b border-gray-700">
          {['workers', 'payroll', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'workers' && (
        <WorkerList publicKey={publicKey} contract={contract} onUpdate={loadEmployerData} />
      )}
      {activeTab === 'payroll' && (
        <RunPayrollForm
          publicKey={publicKey}
          contract={contract}
          poolBalance={poolBalance}
          onSuccess={loadEmployerData}
        />
      )}
      {activeTab === 'history' && (
        <PayrollRunHistory contract={contract} />
      )}
    </div>
  )
}
