import {
  rpc,
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk'
import { getRpcClient, getNetworkPassphrase } from './stellarClient.js'
import { PUBLIC_CONTRACT_ID } from './constants.js'

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

async function registerEmployer(publicKey, adminAddress, signTransaction) {
  const rpcClient = getRpcClient()
  const contract = getContract()
  const source = Address.fromString(publicKey)
  const adminScVal = Address.fromString(adminAddress).toScVal()
  const employerScVal = Address.fromString(publicKey).toScVal()

  const tx = await rpcClient
    .prepareTransaction(source)
    .addOperation(contract.call(CONTRACT_METHODS.register_employer, adminScVal, employerScVal))
    .setTimeout(30)
    .build()

  const sim = await rpcClient.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation error: ${sim.error}`)
  }

  const assembled = rpc.assembleTransaction(sim.transactionData.build(), getNetworkPassphrase(), sim).build()
  await signTransaction(assembled.toXDR(), { networkPassphrase: getNetworkPassphrase() })
  const txSigned = rpc.parseRawSimulation(sim)
  const finalTx = rpc.assembleTransaction(txSigned.transactionData.build(), getNetworkPassphrase(), txSigned).build()

  const result = await rpcClient.sendTransaction(finalTx)
  if (result.status === 'ERROR') {
    throw new Error(`Transaction failed: ${JSON.stringify(result)}`)
  }
  return result
}

async function fundPool(publicKey, amount, signTransaction) {
  const rpcClient = getRpcClient()
  const contract = getContract()
  const source = Address.fromString(publicKey)
  const employerScVal = Address.fromString(publicKey).toScVal()
  const amountScVal = nativeToScVal(amount, { type: 'i128' })

  const tx = await rpcClient
    .prepareTransaction(source)
    .addOperation(contract.call(CONTRACT_METHODS.fund_pool, employerScVal, amountScVal))
    .setTimeout(30)
    .build()

  const sim = await rpcClient.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation error: ${sim.error}`)
  }

  const assembled = rpc.assembleTransaction(sim.transactionData.build(), getNetworkPassphrase(), sim).build()
  await signTransaction(assembled.toXDR(), { networkPassphrase: getNetworkPassphrase() })

  const result = await rpcClient.sendTransaction(assembled)
  if (result.status === 'ERROR') {
    throw new Error(`Transaction failed: ${JSON.stringify(result)}`)
  }
  return result
}

async function addWorker(publicKey, workerAddress, signTransaction) {
  const rpcClient = getRpcClient()
  const contract = getContract()
  const source = Address.fromString(publicKey)
  const employerScVal = Address.fromString(publicKey).toScVal()
  const workerScVal = Address.fromString(workerAddress).toScVal()

  const tx = await rpcClient
    .prepareTransaction(source)
    .addOperation(contract.call(CONTRACT_METHODS.add_worker, employerScVal, workerScVal))
    .setTimeout(30)
    .build()

  const sim = await rpcClient.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation error: ${sim.error}`)
  }

  const assembled = rpc.assembleTransaction(sim.transactionData.build(), getNetworkPassphrase(), sim).build()
  await signTransaction(assembled.toXDR(), { networkPassphrase: getNetworkPassphrase() })

  const result = await rpcClient.sendTransaction(assembled)
  if (result.status === 'ERROR') {
    throw new Error(`Transaction failed: ${JSON.stringify(result)}`)
  }
  return result
}

async function removeWorker(publicKey, workerAddress, signTransaction) {
  const rpcClient = getRpcClient()
  const contract = getContract()
  const source = Address.fromString(publicKey)
  const employerScVal = Address.fromString(publicKey).toScVal()
  const workerScVal = Address.fromString(workerAddress).toScVal()

  const tx = await rpcClient
    .prepareTransaction(source)
    .addOperation(contract.call(CONTRACT_METHODS.remove_worker, employerScVal, workerScVal))
    .setTimeout(30)
    .build()

  const sim = await rpcClient.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation error: ${sim.error}`)
  }

  const assembled = rpc.assembleTransaction(sim.transactionData.build(), getNetworkPassphrase(), sim).build()
  await signTransaction(assembled.toXDR(), { networkPassphrase: getNetworkPassphrase() })

  const result = await rpcClient.sendTransaction(assembled)
  if (result.status === 'ERROR') {
    throw new Error(`Transaction failed: ${JSON.stringify(result)}`)
  }
  return result
}

async function runPayroll(publicKey, payouts, signTransaction) {
  const rpcClient = getRpcClient()
  const contract = getContract()
  const source = Address.fromString(publicKey)
  const employerScVal = Address.fromString(publicKey).toScVal()

  const payoutEntries = payouts.map(({ address, amount }) => {
    const addrScVal = Address.fromString(address).toScVal()
    const amtScVal = nativeToScVal(String(amount), { type: 'i128' })
    return nativeToScVal([addrScVal, amtScVal], { type: 'tuple' })
  })
  const payoutsScVal = nativeToScVal(payoutEntries, { type: 'vec' })

  const tx = await rpcClient
    .prepareTransaction(source)
    .addOperation(contract.call(CONTRACT_METHODS.run_payroll, employerScVal, payoutsScVal))
    .setTimeout(30)
    .build()

  const sim = await rpcClient.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation error: ${sim.error}`)
  }

  const assembled = rpc.assembleTransaction(sim.transactionData.build(), getNetworkPassphrase(), sim).build()
  await signTransaction(assembled.toXDR(), { networkPassphrase: getNetworkPassphrase() })

  const result = await rpcClient.sendTransaction(assembled)
  if (result.status === 'ERROR') {
    throw new Error(`Transaction failed: ${JSON.stringify(result)}`)
  }
  return result
}

async function getPoolBalance(employerAddress) {
  const rpcClient = getRpcClient()
  const contract = getContract()
  const source = Address.fromString(employerAddress)
  const employerScVal = Address.fromString(employerAddress).toScVal()

  try {
    const tx = await rpcClient
      .prepareTransaction(source)
      .addOperation(contract.call(CONTRACT_METHODS.get_pool_balance, employerScVal))
      .setTimeout(30)
      .build()

    const sim = await rpcClient.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      return 0
    }
    return scValToNative(sim.result.retval)
  } catch {
    return 0
  }
}

async function getEmployerInfo(employerAddress) {
  const rpcClient = getRpcClient()
  const contract = getContract()
  const source = Address.fromString(employerAddress)
  const employerScVal = Address.fromString(employerAddress).toScVal()

  try {
    const tx = await rpcClient
      .prepareTransaction(source)
      .addOperation(contract.call(CONTRACT_METHODS.get_employer_info, employerScVal))
      .setTimeout(30)
      .build()

    const sim = await rpcClient.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      return { pool_balance: 0, worker_count: 0 }
    }
    const val = scValToNative(sim.result.retval)
    return {
      pool_balance: val?.pool_balance || 0,
      worker_count: val?.worker_count || 0,
    }
  } catch {
    return { pool_balance: 0, worker_count: 0 }
  }
}

async function getWorkerInfo(employerAddress, workerAddress) {
  const rpcClient = getRpcClient()
  const contract = getContract()
  const source = Address.fromString(workerAddress)
  const employerScVal = Address.fromString(employerAddress).toScVal()
  const workerScVal = Address.fromString(workerAddress).toScVal()

  try {
    const tx = await rpcClient
      .prepareTransaction(source)
      .addOperation(contract.call(CONTRACT_METHODS.get_worker_info, employerScVal, workerScVal))
      .setTimeout(30)
      .build()

    const sim = await rpcClient.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      return { total_paid: 0, last_paid_ledger: 0, active: false }
    }
    const val = scValToNative(sim.result.retval)
    return {
      total_paid: val?.total_paid || 0,
      last_paid_ledger: val?.last_paid_ledger || 0,
      active: val?.active ?? false,
    }
  } catch {
    return { total_paid: 0, last_paid_ledger: 0, active: false }
  }
}

async function getPayrollRun(runId) {
  const rpcClient = getRpcClient()
  const contract = getContract()
  const source = Address.fromString(PUBLIC_CONTRACT_ID)
  const runIdScVal = nativeToScVal(runId, { type: 'u64' })

  try {
    const tx = await rpcClient
      .prepareTransaction(source)
      .addOperation(contract.call(CONTRACT_METHODS.get_payroll_run, runIdScVal))
      .setTimeout(30)
      .build()

    const sim = await rpcClient.simulateTransaction(tx)
    if (rpc.Api.isSimulationError(sim)) {
      return null
    }
    return scValToNative(sim.result.retval)
  } catch {
    return null
  }
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
}
