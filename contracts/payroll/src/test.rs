#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{PayrollContract, PayrollContractClient};

fn create_contract(env: &Env) -> PayrollContractClient {
    let contract_id = env.register(PayrollContract, ());
    PayrollContractClient::new(env, &contract_id)
}

#[test]
fn test_initialize_sets_admin_and_token() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin, &usdc);

    let stored_admin: Address = env.as_contract(&contract.address, || {
        env.storage().instance().get(&crate::DataKey::Admin).unwrap()
    });
    assert_eq!(stored_admin, admin);

    let stored_token: Address = env.as_contract(&contract.address, || {
        env.storage()
            .instance()
            .get(&crate::DataKey::UsdcToken)
            .unwrap()
    });
    assert_eq!(stored_token, usdc);
}

#[test]
#[should_panic(expected = "Contract already initialized")]
fn test_initialize_cannot_be_called_twice() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let usdc = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin, &usdc);
    contract.initialize(&admin, &usdc);
}
