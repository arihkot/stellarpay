# StellarPay — Cross-Border Payroll & Remittance for Gig Workers

> StellarPay lets employers pay gig workers anywhere in the world in USDC, and lets workers cash out into local currency in seconds — powered by Stellar's path payments, Soroban smart contracts, and the anchor network.

## Live Demo

- **Frontend URL**: [https://stellarpay.pages.dev](https://stellarpay.pages.dev)
- **Network**: Stellar Testnet

## Deployed Contracts

| Item | Value |
|---|---|
| Contract ID | `TBD` (see deployment output) |
| WASM Hash | `TBD` |
| Network | Testnet (`Test SDF Network ; September 2015`) |
| Alias | `payroll` |

## Example Transaction

- **Transaction Hash**: `TBD`
- **StellarExpert Link**: `https://stellar.expert/explorer/testnet/tx/TBD`

## Architecture

```
┌─────────────────────────────┐        ┌──────────────────────────┐
│   Frontend (React + Vite)   │        │   Soroban Payroll Contract │
│   deployed on Cloudflare    │◄──────►│   (Rust/WASM, Testnet)     │
│   Pages/Workers             │  RPC   └──────────────────────────┘
└──────────┬───────────────────┘
           │ signs via
           ▼
┌─────────────────────────────┐
│  Freighter Wallet Extension │
└──────────┬───────────────────┘
           │ submits classic ops (path payment, SEP flows)
           ▼
┌─────────────────────────────┐        ┌──────────────────────────┐
│  Stellar Testnet Horizon /   │◄──────►│  testanchor.stellar.org   │
│  Soroban RPC                 │  SEP-  │  (SEP-1/6/10/12/24/31/38) │
└─────────────────────────────┘  24/31  └──────────────────────────┘
```

### Why path payments live outside the contract

Soroban transactions containing an `InvokeHostFunctionOp` must contain only that one operation — they cannot be combined with classic `PathPaymentStrictSend`/`Receive` operations. The architecture uses two cleanly separated layers:

- **Layer 1 — On-chain payroll ledger (Soroban contract):** Employer deposits USDC into contract custody, the contract tracks worker balances owed, and `disburse` moves USDC from contract custody to each worker's Stellar account.
- **Layer 2 — FX + cash-out (classic Stellar ops + SEPs):** The worker's own wallet (Freighter) submits a classic path payment to convert USDC into local currency, followed by a SEP-24 interactive withdrawal via `testanchor.stellar.org`.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite (deployed on Cloudflare Pages) |
| Styling | Tailwind CSS |
| Stellar SDK | `@stellar/stellar-sdk` |
| Wallet | `@stellar/freighter-api` |
| Smart Contract | Rust + `soroban-sdk`, compiled to WASM |
| Anchor | `testanchor.stellar.org` (SDF reference SEP server) |
| Bridge Asset | Testnet USDC (Circle): `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| CI/CD | GitHub Actions + Cloudflare Wrangler |

## Local Setup

### Prerequisites

- Node.js 20+
- Rust toolchain with `wasm32-unknown-unknown` target
- [Freighter browser extension](https://www.freighter.app/) (configured for Testnet)
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli) (`stellar`)

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
VITE_PUBLIC_CONTRACT_ID=<your_deployed_contract_id>
VITE_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
VITE_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_PUBLIC_ANCHOR_HOME_DOMAIN=https://testanchor.stellar.org
```

### Install & Run

```bash
# Frontend
cd frontend
npm install
npm run dev     # Start dev server at http://localhost:5173

# Contract
cd contracts/payroll
cargo build --release --target wasm32-unknown-unknown
cargo test      # Run contract tests
```

### Deploy Contract

```bash
cd contracts/payroll

# Generate a funded account for deployment
stellar keys generate deployer --network testnet --fund

# Build
cargo build --release --target wasm32-unknown-unknown

# Deploy
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/payroll.wasm \
  --source-account deployer \
  --network testnet \
  --alias payroll

# Initialize
stellar contract invoke \
  --id payroll \
  --source-account deployer \
  --network testnet \
  -- initialize \
  --admin <DEPLOYER_ADDRESS> \
  --usdc_token <USDC_SAC_ADDRESS>
```

## Testing

### Contract Tests (8 tests)

```bash
cd contracts/payroll
cargo test
```

Tests cover: initialize, double-init protection, employer registration + pool funding, worker add/remove, payroll distribution, insufficient balance, unregistered worker, and event emission.

### Frontend Tests (19 tests)

```bash
cd frontend
npm test
```

Tests cover: wallet connection (connect, disconnect, wrong network, Freighter missing), payroll form validation (empty fields, negative/zero amounts, duplicates, pool overflow), cash-out quote component (rendering, button states, success/error), contract client status (loading, error, tx hash, idle), and responsive layout (cards render without overflow).

## Seed Data (55 testnet users)

**Disclosure:** The testnet contract has been seeded with 55 synthetic worker/employer accounts across multiple payroll runs to demonstrate the full payment lifecycle. This is standard testnet demo preparation — not organic user adoption.

The seeding script is located at `scripts/seed/` (gitignored) and:
- Generates 55 testnet keypairs with Friendbot funding
- Registers 3 employers and distributes 52 workers across them
- Creates varied payout amounts across multiple payroll runs
- Executes the full path-payment + SEP-24 cash-out flow for a subset of workers

## CI/CD Pipeline

| Event | Action |
|---|---|
| Pull Request → `main` | Lint + Test + Build |
| Push/Merge → `main` | Build + Deploy to Cloudflare Pages |
| Manual trigger | Deploy contract (testnet/mainnet) |

## Known Limitations

- **Testnet only** — not deployed on Stellar mainnet
- **Mocked KYC** — uses SDF reference anchor (`testanchor.stellar.org`) with simulated KYC
- **Single wallet** — Freighter only (multi-wallet support planned for v2)
- **Contract state expiry** — Soroban testnet contracts can be archived after inactivity; re-invoke a read call periodically or redeploy before demos

## Reference Values

| Resource | Value |
|---|---|
| Network Passphrase | `Test SDF Network ; September 2015` |
| Soroban RPC | `https://soroban-testnet.stellar.org` |
| Horizon | `https://horizon-testnet.stellar.org` |
| Testnet USDC Issuer | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |
| Reference Anchor | `https://testanchor.stellar.org` |
| Explorer | `https://stellar.expert/explorer/testnet` |
