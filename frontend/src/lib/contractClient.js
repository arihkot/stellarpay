import {
  rpc,
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
  TransactionBuilder,
} from '@stellar/stellar-sdk'
import { getRpcClient, getNetworkPassphrase } from './stellarClient.js'
import { PUBLIC_CONTRACT_ID } from './constants.js'

const CACHE_TTL = 15000
const cache = new Map()

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.value
}

function setCached(key, value) {
  cache.set(key, { value, timestamp: Date.now() })
}

async function withRetry(fn, maxRetries = 3) {
  let lastError
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000))
      }
    }
  }
  throw lastError
}

const CONTRACT_METHODS = {
  initialize: 'initialize',
  register_employer: 'register_employer',
  fund_pool: 'fund_pool',
  add_worker: 'add_worker',
  remove_worker: 'remove_worker',
  run_payroll: 'run_payroll',
  get_pool_balance: 'get_pool_balance',
  get_employer_info: 'get_employer_info',
  get_worker_info: 'get_worker_info',
  get_payroll_run: 'get_payroll_run',
}

function getContract(contractId = PUBLIC_CONTRACT_ID) {
  if (!contractId) throw new Error('Contract ID not configured')
  return new Contract(contractId)
}

async function buildAndSimulate(sourcePubKey, method, args) {
  const rpcClient = getRpcClient()
  const contract = getContract()
  const source = Address.fromString(sourcePubKey)

  const tx = await rpcClient
    .prepareTransaction(source)
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()

  const sim = await withRetry(() => rpcClient.simulateTransaction(tx))
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation error: ${sim.error}`)
  }
  return sim
}

async function signAndSend(simResult, signTransaction) {
  const rpcClient = getRpcClient()
  const assembled = rpc
    .assembleTransaction(simResult.transactionData.build(), getNetworkPassphrase(), simResult)
    .build()

  const signedXdr = await signTransaction(assembled.toXDR(), { networkPassphrase: getNetworkPassphrase() })
  const signedTx = TransactionBuilder.fromXDR(signedXdr, getNetworkPassphrase())

  const result = await withRetry(() => rpcClient.sendTransaction(signedTx))
  if (result.status === 'ERROR') {
    throw new Error(`Transaction failed: ${result.error || JSON.stringify(result)}`)
  }
  return result
}

async function registerEmployer(publicKey, adminAddress, signTransaction) {
  const adminScVal = Address.fromString(adminAddress).toScVal()
  const employerScVal = Address.fromString(publicKey).toScVal()
  const sim = await buildAndSimulate(publicKey, CONTRACT_METHODS.register_employer, [adminScVal, employerScVal])
  return signAndSend(sim, signTransaction)
}

async function fundPool(publicKey, amount, signTransaction) {
  const employerScVal = Address.fromString(publicKey).toScVal()
  const amountScVal = nativeToScVal(amount, { type: 'i128' })
  const sim = await buildAndSimulate(publicKey, CONTRACT_METHODS.fund_pool, [employerScVal, amountScVal])
  return signAndSend(sim, signTransaction)
}

async function addWorker(publicKey, workerAddress, signTransaction) {
  const employerScVal = Address.fromString(publicKey).toScVal()
  const workerScVal = Address.fromString(workerAddress).toScVal()
  const sim = await buildAndSimulate(publicKey, CONTRACT_METHODS.add_worker, [employerScVal, workerScVal])
  return signAndSend(sim, signTransaction)
}

async function removeWorker(publicKey, workerAddress, signTransaction) {
  const employerScVal = Address.fromString(publicKey).toScVal()
  const workerScVal = Address.fromString(workerAddress).toScVal()
  const sim = await buildAndSimulate(publicKey, CONTRACT_METHODS.remove_worker, [employerScVal, workerScVal])
  return signAndSend(sim, signTransaction)
}

async function runPayroll(publicKey, payouts, signTransaction) {
  const source = Address.fromString(publicKey)
  const rpcClient = getRpcClient()
  const contract = getContract()
  const employerScVal = Address.fromString(publicKey).toScVal()

  const payoutScVals = payouts.map(({ address, amount }) => {
    const addrScVal = Address.fromString(address).toScVal()
    const amtScVal = nativeToScVal(String(amount), { type: 'i128' })
    return xdr.ScVal.scvVec([xdr.ScVal.scvVec([addrScVal, amtScVal])])
  })

  const tx = await rpcClient
    .prepareTransaction(source)
    .addOperation(contract.call(CONTRACT_METHODS.run_payroll, employerScVal, ...payoutScVals))
    .setTimeout(30)
    .build()

  const sim = await withRetry(() => rpcClient.simulateTransaction(tx))
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation error: ${sim.error}`)
  }

  return signAndSend(sim, signTransaction)
}

async function getPoolBalance(employerAddress) {
  const cacheKey = `pool_balance:${employerAddress}`
  const cached = getCached(cacheKey)
  if (cached !== null) return cached

  try {
    const source = Address.fromString(employerAddress)
    const rpcClient = getRpcClient()
    const contract = getContract()
    const employerScVal = Address.fromString(employerAddress).toScVal()

    const tx = await rpcClient
      .prepareTransaction(source)
      .addOperation(contract.call(CONTRACT_METHODS.get_pool_balance, employerScVal))
      .setTimeout(30)
      .build()

    const sim = await withRetry(() => rpcClient.simulateTransaction(tx))
    if (rpc.Api.isSimulationError(sim)) return 0
    const val = scValToNative(sim.result.retval)
    setCached(cacheKey, val)
    return val
  } catch {
    return 0
  }
}

async function getEmployerInfo(employerAddress) {
  const cacheKey = `employer_info:${employerAddress}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const source = Address.fromString(employerAddress)
    const rpcClient = getRpcClient()
    const contract = getContract()
    const employerScVal = Address.fromString(employerAddress).toScVal()

    const tx = await rpcClient
      .prepareTransaction(source)
      .addOperation(contract.call(CONTRACT_METHODS.get_employer_info, employerScVal))
      .setTimeout(30)
      .build()

    const sim = await withRetry(() => rpcClient.simulateTransaction(tx))
    if (rpc.Api.isSimulationError(sim)) {
      return { pool_balance: 0, worker_count: 0 }
    }
    const val = scValToNative(sim.result.retval)
    const result = {
      pool_balance: val?.pool_balance || 0,
      worker_count: val?.worker_count || 0,
    }
    setCached(cacheKey, result)
    return result
  } catch {
    return { pool_balance: 0, worker_count: 0 }
  }
}

async function getWorkerInfo(employerAddress, workerAddress) {
  const cacheKey = `worker_info:${employerAddress}:${workerAddress}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const source = Address.fromString(workerAddress)
    const rpcClient = getRpcClient()
    const contract = getContract()
    const employerScVal = Address.fromString(employerAddress).toScVal()
    const workerScVal = Address.fromString(workerAddress).toScVal()

    const tx = await rpcClient
      .prepareTransaction(source)
      .addOperation(contract.call(CONTRACT_METHODS.get_worker_info, employerScVal, workerScVal))
      .setTimeout(30)
      .build()

    const sim = await withRetry(() => rpcClient.simulateTransaction(tx))
    if (rpc.Api.isSimulationError(sim)) {
      return { total_paid: 0, last_paid_ledger: 0, active: false }
    }
    const val = scValToNative(sim.result.retval)
    const result = {
      total_paid: val?.total_paid || 0,
      last_paid_ledger: val?.last_paid_ledger || 0,
      active: val?.active ?? false,
    }
    setCached(cacheKey, result)
    return result
  } catch {
    return { total_paid: 0, last_paid_ledger: 0, active: false }
  }
}

async function getPayrollRun(runId) {
  const cacheKey = `payroll_run:${runId}`
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const source = Address.fromString(PUBLIC_CONTRACT_ID)
    const rpcClient = getRpcClient()
    const contract = getContract()
    const runIdScVal = nativeToScVal(runId, { type: 'u64' })

    const tx = await rpcClient
      .prepareTransaction(source)
      .addOperation(contract.call(CONTRACT_METHODS.get_payroll_run, runIdScVal))
      .setTimeout(30)
      .build()

    const sim = await withRetry(() => rpcClient.simulateTransaction(tx))
    if (rpc.Api.isSimulationError(sim)) return null
    const val = scValToNative(sim.result.retval)
    setCached(cacheKey, val)
    return val
  } catch {
    return null
  }
}

function clearCache() {
  cache.clear()
}

export {
  CONTRACT_METHODS,
  registerEmployer,
  fundPool,
  addWorker,
  removeWorker,
  runPayroll,
  getPoolBalance,
  getEmployerInfo,
  getWorkerInfo,
  getPayrollRun,
  clearCache,
}
