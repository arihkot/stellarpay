#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Events as _,},
    token::StellarAssetClient,
    Address, Env, Vec,
};

use crate::{EmployerInfo, PayrollContract, PayrollContractClient, WorkerInfo};

fn create_token_contract(env: &Env, admin: &Address) -> Address {
    env.register_stellar_asset_contract_v2(admin.clone()).address()
}

fn create_contract<'a>(env: &'a Env) -> PayrollContractClient<'a> {
    let contract_id = env.register(PayrollContract, ());
    PayrollContractClient::new(env, &contract_id)
}

#[test]
fn test_initialize_sets_admin_and_token() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let contract = create_contract(&env);

    env.mock_all_auths();
    contract.initialize(&admin, &usdc);

    let key = crate::DataKey::Admin;
    let stored_admin: Address = env.as_contract(&contract.address, || {
        env.storage().instance().get(&key).unwrap()
    });
    assert_eq!(stored_admin, admin);
}

#[test]
#[should_panic(expected = "Contract already initialized")]
fn test_initialize_cannot_be_called_twice() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let contract = create_contract(&env);

    env.mock_all_auths();
    contract.initialize(&admin, &usdc);
    contract.initialize(&admin, &usdc);
}

#[test]
fn test_register_employer_and_fund_pool() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &admin);
    let employer = Address::generate(&env);

    let contract = create_contract(&env);

    env.mock_all_auths();
    contract.initialize(&admin, &usdc);
    contract.register_employer(&admin, &employer);

    let info: EmployerInfo = contract.get_employer_info(&employer);
    assert_eq!(info.pool_balance, 0);
    assert_eq!(info.worker_count, 0);

    let token_admin = StellarAssetClient::new(&env, &usdc);
    token_admin.mint(&employer, &10_000_0000000_i128);

    contract.fund_pool(&employer, &5_000_0000000_i128);

    let info: EmployerInfo = contract.get_employer_info(&employer);
    assert_eq!(info.pool_balance, 5_000_0000000_i128);
}

#[test]
fn test_add_and_remove_worker() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let usdc_addr = Address::generate(&env);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);

    let contract = create_contract(&env);

    env.mock_all_auths();
    contract.initialize(&admin, &usdc_addr);
    contract.register_employer(&admin, &employer);

    contract.add_worker(&employer, &worker);

    let worker_info: WorkerInfo = contract.get_worker_info(&employer, &worker);
    assert!(worker_info.active);
    assert_eq!(worker_info.total_paid, 0);

    let employer_info: EmployerInfo = contract.get_employer_info(&employer);
    assert_eq!(employer_info.worker_count, 1);

    contract.remove_worker(&employer, &worker);

    let worker_info: WorkerInfo = contract.get_worker_info(&employer, &worker);
    assert!(!worker_info.active);

    let employer_info: EmployerInfo = contract.get_employer_info(&employer);
    assert_eq!(employer_info.worker_count, 0);
}

#[test]
fn test_run_payroll_distributes_exact_amounts() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &admin);
    let employer = Address::generate(&env);
    let worker1 = Address::generate(&env);
    let worker2 = Address::generate(&env);

    let contract = create_contract(&env);

    env.mock_all_auths();
    contract.initialize(&admin, &usdc);
    contract.register_employer(&admin, &employer);
    contract.add_worker(&employer, &worker1);
    contract.add_worker(&employer, &worker2);

    let token_admin = StellarAssetClient::new(&env, &usdc);
    token_admin.mint(&employer, &10_000_0000000_i128);
    contract.fund_pool(&employer, &5_000_0000000_i128);

    let payouts = Vec::from_array(
        &env,
        [
            (worker1.clone(), 2_000_0000000_i128),
            (worker2.clone(), 1_000_0000000_i128),
        ],
    );

    let run_id = contract.run_payroll(&employer, &payouts);
    assert_eq!(run_id, 1);

    let remaining = contract.get_pool_balance(&employer);
    assert_eq!(remaining, 2_000_0000000_i128);

    let w1: WorkerInfo = contract.get_worker_info(&employer, &worker1);
    assert_eq!(w1.total_paid, 2_000_0000000_i128);

    let w2: WorkerInfo = contract.get_worker_info(&employer, &worker2);
    assert_eq!(w2.total_paid, 1_000_0000000_i128);

    let run = contract.get_payroll_run(&run_id);
    assert_eq!(run.total_amount, 3_000_0000000_i128);
    assert_eq!(run.worker_count, 2);
}

#[test]
#[should_panic(expected = "Insufficient pool balance")]
fn test_run_payroll_fails_with_insufficient_balance() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &admin);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);

    let contract = create_contract(&env);

    env.mock_all_auths();
    contract.initialize(&admin, &usdc);
    contract.register_employer(&admin, &employer);
    contract.add_worker(&employer, &worker);

    let token_admin = StellarAssetClient::new(&env, &usdc);
    token_admin.mint(&employer, &1_000_0000000_i128);
    contract.fund_pool(&employer, &1_000_0000000_i128);

    let payouts = Vec::from_array(&env, [(worker, 2_000_0000000_i128)]);

    contract.run_payroll(&employer, &payouts);
}

#[test]
#[should_panic(expected = "Worker not registered")]
fn test_run_payroll_fails_with_unregistered_worker() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &admin);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);

    let contract = create_contract(&env);

    env.mock_all_auths();
    contract.initialize(&admin, &usdc);
    contract.register_employer(&admin, &employer);

    let token_admin = StellarAssetClient::new(&env, &usdc);
    token_admin.mint(&employer, &5_000_0000000_i128);
    contract.fund_pool(&employer, &5_000_0000000_i128);

    let payouts = Vec::from_array(&env, [(worker, 1_000_0000000_i128)]);

    contract.run_payroll(&employer, &payouts);
}

#[test]
fn test_contract_emits_events() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let usdc = create_token_contract(&env, &admin);
    let employer = Address::generate(&env);
    let worker = Address::generate(&env);

    let contract = create_contract(&env);

    env.mock_all_auths();
    contract.initialize(&admin, &usdc);
    contract.register_employer(&admin, &employer);
    contract.add_worker(&employer, &worker);

    let token_admin = StellarAssetClient::new(&env, &usdc);
    token_admin.mint(&employer, &2_000_0000000_i128);
    contract.fund_pool(&employer, &1_000_0000000_i128);

    let payouts = Vec::from_array(&env, [(worker, 1_000_0000000_i128)]);
    contract.run_payroll(&employer, &payouts);

    let events = env.events().all();
    assert!(!events.is_empty());
}
