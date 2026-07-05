import { useState } from 'react'

export default function WorkerList({ publicKey, contract, onUpdate }) {
  const [workerAddress, setWorkerAddress] = useState('')
  const [workers, setWorkers] = useState([])

  async function handleAddWorker() {
    if (!workerAddress) return
    try {
      await contract.addWorker(publicKey, workerAddress)
      setWorkers([...workers, { address: workerAddress, active: true }])
      setWorkerAddress('')
      onUpdate?.()
    } catch (err) {
      alert(`Failed to add worker: ${err.message}`)
    }
  }

  async function handleRemoveWorker(address) {
    try {
      await contract.removeWorker(publicKey, address)
      setWorkers(workers.map((w) =>
        w.address === address ? { ...w, active: false } : w
      ))
      onUpdate?.()
    } catch (err) {
      alert(`Failed to remove worker: ${err.message}`)
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-4">Worker Registry</h3>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={workerAddress}
          onChange={(e) => setWorkerAddress(e.target.value)}
          placeholder="Worker Stellar address (G...)"
          className="flex-1 px-3 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 text-sm font-mono"
        />
        <button
          onClick={handleAddWorker}
          disabled={contract.loading || !workerAddress || !workerAddress.startsWith('G')}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors text-sm"
        >
          Add Worker
        </button>
      </div>

      {workers.length === 0 ? (
        <p className="text-sm text-gray-500">No workers registered yet. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {workers.map((w, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-lg bg-gray-700/50"
            >
              <div>
                <p className="text-sm font-mono text-gray-300 truncate max-w-[240px] sm:max-w-md">
                  {w.address}
                </p>
                <p className="text-xs text-gray-500">
                  {w.active ? 'Active' : 'Inactive'}
                </p>
              </div>
              {w.active && (
                <button
                  onClick={() => handleRemoveWorker(w.address)}
                  className="px-3 py-1 rounded text-sm bg-red-900/50 text-red-400 hover:bg-red-800/50 transition-colors flex-shrink-0"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
