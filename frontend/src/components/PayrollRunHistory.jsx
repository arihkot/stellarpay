import { useState, useEffect, useCallback } from 'react'


export default function PayrollRunHistory({ contract }) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const history = []
      let runId = 1
      let found = true

      while (found && runId <= 20) {
        try {
          const run = await contract.getPayrollRun(runId)
          if (run) {
            history.push({ id: runId, ...run })
          } else {
            found = false
          }
        } catch {
          found = false
        }
        runId++
      }

      setRuns(history.reverse())
    } catch (_err) {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [contract])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-4">Payroll Run History</h3>

      {loading && <p className="text-sm text-gray-500">Loading history...</p>}

      {!loading && runs.length === 0 && (
        <p className="text-sm text-gray-500">No payroll runs yet.</p>
      )}

      {runs.length > 0 && (
        <div className="space-y-3">
          {runs.map((run) => (
            <div
              key={run.id}
              className="p-4 rounded-lg bg-gray-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div>
                <p className="text-sm font-medium">
                  Run #{run.id}
                  <span className="ml-2 text-xs text-gray-500">
                    {run.worker_count} workers
                  </span>
                </p>
                <p className="text-sm text-green-400">
                  ${(Number(run.total_amount) / 1e7).toFixed(2)} USDC
                </p>
                {run.timestamp && (
                  <p className="text-xs text-gray-500">
                    {new Date(Number(run.timestamp) * 1000).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
