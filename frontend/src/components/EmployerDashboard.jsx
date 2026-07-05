import { useState, useEffect } from 'react'
import { useWalletContext } from '../contexts/WalletContext.jsx'
import { useContract } from '../hooks/useContract.js'
import { STELLAR_EXPERT_TX } from '../lib/constants.js'
import WorkerList from './WorkerList.jsx'
import RunPayrollForm from './RunPayrollForm.jsx'
import PayrollRunHistory from './PayrollRunHistory.jsx'

export default function EmployerDashboard() {
  const { publicKey, connect } = useWalletContext()
  const contract = useContract()
  const [poolBalance, setPoolBalance] = useState(0)
  const [workers, _setWorkers] = useState([])
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [adminAddress, setAdminAddress] = useState('')
  const [fundAmount, setFundAmount] = useState('')
  const [activeTab, setActiveTab] = useState('workers')

  useEffect(() => {
    if (publicKey) {
      loadEmployerData()
    }
  }, [publicKey])

  async function loadEmployerData() {
    try {
      const info = await contract.getEmployerInfo(publicKey)
      setPoolBalance(Number(info.pool_balance) / 1e7)
    } catch (_err) {
      // silently fail on first load
    }
  }

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">Pool Balance</p>
          <p className="text-2xl font-bold">${poolBalance.toFixed(2)} USDC</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-400 mb-1">Workers</p>
          <p className="text-2xl font-bold">{workers.length}</p>
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
        <WorkerList publicKey={publicKey} contract={contract} />
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
