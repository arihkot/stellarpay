#![no_std]
use soroban_sdk::{
    contract, contractimpl, token, Address, Env, Symbol, Vec,
};

mod types;

pub use types::*;

#[contract]
pub struct PayrollContract;

fn get_usdc_token(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::UsdcToken).unwrap()
}

fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

fn get_run_counter(env: &Env) -> u64 {
    env.storage().instance().get(&DataKey::RunCounter).unwrap_or(0)
}

fn increment_run_counter(env: &Env) -> u64 {
    let counter: u64 = get_run_counter(env);
    let next = counter + 1;
    env.storage().instance().set(&DataKey::RunCounter, &next);
    next
}

#[contractimpl]
impl PayrollContract {
    pub fn initialize(env: Env, admin: Address, usdc_token: Address) {
        admin.require_auth();
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::UsdcToken, &usdc_token);
        env.storage().instance().set(&DataKey::RunCounter, &0u64);
        env.events().publish(
            (Symbol::new(&env, "initialized"),),
            (admin, usdc_token),
        );
    }

    pub fn register_employer(env: Env, admin: Address, employer: Address) {
        admin.require_auth();
        let stored_admin = get_admin(&env);
        if admin != stored_admin {
            panic!("Caller is not the admin");
        }

        let key = DataKey::Employer(employer.clone());
        if env.storage().instance().has(&key) {
            panic!("Employer already registered");
        }
        let usdc = get_usdc_token(&env);
        let info = EmployerInfo {
            usdc_token: usdc,
            pool_balance: 0,
            worker_count: 0,
        };
        env.storage().instance().set(&key, &info);

        env.events().publish(
            (Symbol::new(&env, "employer_registered"),),
            employer,
        );
    }

    pub fn fund_pool(env: Env, employer: Address, amount: i128) {
        employer.require_auth();

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let key = DataKey::Employer(employer.clone());
        let mut info: EmployerInfo = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic!("Employer not registered"));

        let usdc = info.usdc_token.clone();
        let token_client = token::Client::new(&env, &usdc);
        let contract_address = env.current_contract_address();

        token_client.transfer(&employer, &contract_address, &amount);

        info.pool_balance += amount;
        env.storage().instance().set(&key, &info);

        env.events().publish(
            (Symbol::new(&env, "pool_funded"), employer.clone()),
            amount,
        );
    }

    pub fn add_worker(env: Env, employer: Address, worker: Address) {
        employer.require_auth();

        let employer_key = DataKey::Employer(employer.clone());
        let mut info: EmployerInfo = env
            .storage()
            .instance()
            .get(&employer_key)
            .unwrap_or_else(|| panic!("Employer not registered"));

        let worker_key = DataKey::Worker(employer.clone(), worker.clone());
        if env.storage().instance().has(&worker_key) {
            panic!("Worker already registered");
        }

        let worker_info = WorkerInfo {
            total_paid: 0,
            last_paid_ledger: env.ledger().sequence(),
            active: true,
        };
        env.storage().instance().set(&worker_key, &worker_info);

        info.worker_count += 1;
        env.storage().instance().set(&employer_key, &info);

        env.events().publish(
            (Symbol::new(&env, "worker_added"), employer, worker),
            (),
        );
    }

    pub fn remove_worker(env: Env, employer: Address, worker: Address) {
        employer.require_auth();

        let employer_key = DataKey::Employer(employer.clone());
        let mut info: EmployerInfo = env
            .storage()
            .instance()
            .get(&employer_key)
            .unwrap_or_else(|| panic!("Employer not registered"));

        let worker_key = DataKey::Worker(employer.clone(), worker.clone());
        let mut worker_info: WorkerInfo = env
            .storage()
            .instance()
            .get(&worker_key)
            .unwrap_or_else(|| panic!("Worker not found"));

        worker_info.active = false;
        env.storage().instance().set(&worker_key, &worker_info);

        info.worker_count = info.worker_count.saturating_sub(1);
        env.storage().instance().set(&employer_key, &info);

        env.events().publish(
            (Symbol::new(&env, "worker_removed"), employer, worker),
            (),
        );
    }

    pub fn run_payroll(
        env: Env,
        employer: Address,
        payouts: Vec<(Address, i128)>,
    ) -> u64 {
        employer.require_auth();

        if payouts.is_empty() {
            panic!("Payouts list is empty");
        }

        let employer_key = DataKey::Employer(employer.clone());
        let mut info: EmployerInfo = env
            .storage()
            .instance()
            .get(&employer_key)
            .unwrap_or_else(|| panic!("Employer not registered"));

        let mut total_amount: i128 = 0;
        for payout in payouts.iter() {
            let (_worker_addr, amount) = payout;
            if amount <= 0 {
                panic!("Payout amount must be positive");
            }
            total_amount += amount;
        }

        if total_amount > info.pool_balance {
            panic!("Insufficient pool balance");
        }

        let usdc = info.usdc_token.clone();
        let token_client = token::Client::new(&env, &usdc);
        let contract_address = env.current_contract_address();

        for payout in payouts.iter() {
            let (ref worker_addr, ref amount) = payout;

            let worker_key = DataKey::Worker(employer.clone(), worker_addr.clone());
            let mut worker_info: WorkerInfo = env
                .storage()
                .instance()
                .get(&worker_key)
                .unwrap_or_else(|| panic!("Worker not registered"));

            token_client.transfer(&contract_address, worker_addr, amount);

            worker_info.total_paid += amount;
            worker_info.last_paid_ledger = env.ledger().sequence();
            env.storage().instance().set(&worker_key, &worker_info);

            env.events().publish(
                (
                    Symbol::new(&env, "payout_sent"),
                    employer.clone(),
                    worker_addr.clone(),
                ),
                amount,
            );
        }

        info.pool_balance -= total_amount;
        env.storage().instance().set(&employer_key, &info);

        let run_id = increment_run_counter(&env);
        let run_info = PayrollRunInfo {
            employer: employer.clone(),
            total_amount,
            worker_count: payouts.len() as u32,
            timestamp: env.ledger().timestamp(),
        };
        env.storage()
            .instance()
            .set(&DataKey::PayrollRun(run_id), &run_info);

        env.events().publish(
            (Symbol::new(&env, "payroll_run"), employer, run_id),
            total_amount,
        );

        run_id
    }

    pub fn get_pool_balance(env: Env, employer: Address) -> i128 {
        let key = DataKey::Employer(employer);
        let info: EmployerInfo = env
            .storage()
            .instance()
            .get(&key)
            .unwrap_or(EmployerInfo {
                usdc_token: get_usdc_token(&env),
                pool_balance: 0,
                worker_count: 0,
            });
        info.pool_balance
    }

    pub fn get_employer_info(env: Env, employer: Address) -> EmployerInfo {
        let key = DataKey::Employer(employer);
        env.storage()
            .instance()
            .get(&key)
            .unwrap_or(EmployerInfo {
                usdc_token: get_usdc_token(&env),
                pool_balance: 0,
                worker_count: 0,
            })
    }

    pub fn get_worker_info(
        env: Env,
        employer: Address,
        worker: Address,
    ) -> WorkerInfo {
        let key = DataKey::Worker(employer, worker);
        env.storage()
            .instance()
            .get(&key)
            .unwrap_or(WorkerInfo {
                total_paid: 0,
                last_paid_ledger: 0,
                active: false,
            })
    }

    pub fn get_payroll_run(env: Env, run_id: u64) -> PayrollRunInfo {
        let key = DataKey::PayrollRun(run_id);
        env.storage()
            .instance()
            .get(&key)
            .unwrap_or_else(|| panic!("Payroll run not found"))
    }
}

mod test;
