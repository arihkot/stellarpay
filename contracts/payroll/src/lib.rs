#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Symbol};

mod types;
mod errors;

pub use types::*;

#[contract]
pub struct PayrollContract;

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
}

mod test;
