use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    UsdcToken,
    Employer(Address),
    Worker(Address, Address),
    PayrollRun(u64),
    RunCounter,
}

#[contracttype]
#[derive(Clone)]
pub struct EmployerInfo {
    pub usdc_token: Address,
    pub pool_balance: i128,
    pub worker_count: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct WorkerInfo {
    pub total_paid: i128,
    pub last_paid_ledger: u32,
    pub active: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct PayrollRunInfo {
    pub employer: Address,
    pub total_amount: i128,
    pub worker_count: u32,
    pub timestamp: u64,
}
