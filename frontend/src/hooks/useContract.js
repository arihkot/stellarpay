import { useState } from 'react'
import {
  registerEmployer,
  fundPool,
  addWorker,
  removeWorker,
  runPayroll,
  getPoolBalance,
  getEmployerInfo,
  getWorkerInfo,
  getPayrollRun,
} from '../lib/contractClient.js'
import { signTx } from '../hooks/useWallet.js'
import { PUBLIC_CONTRACT_ID } from '../lib/constants.js'

export function useContract() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastTxHash, setLastTxHash] = useState(null)

  async function execute(action, ...args) {
    setLoading(true)
    setError(null)
    setLastTxHash(null)
    try {
      const result = await action(...args)
      if (result?.hash) {
        setLastTxHash(result.hash)
      }
      setLoading(false)
      return result
    } catch (err) {
      setError(err.message)
      setLoading(false)
      throw err
    }
  }

  return {
    loading,
    error,
    lastTxHash,
    registerEmployer: (publicKey, adminAddress) =>
      execute(registerEmployer, publicKey, adminAddress, signTx),
    fundPool: (publicKey, amount) =>
      execute(fundPool, publicKey, String(Math.floor(amount * 1e7)), signTx),
    addWorker: (publicKey, workerAddress) =>
      execute(addWorker, publicKey, workerAddress, signTx),
    removeWorker: (publicKey, workerAddress) =>
      execute(removeWorker, publicKey, workerAddress, signTx),
    runPayroll: (publicKey, payouts) =>
      execute(runPayroll, publicKey, payouts, signTx),
    getPoolBalance,
    getEmployerInfo,
    getWorkerInfo,
    getPayrollRun,
  }
}
