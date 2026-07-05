# PRD — StellarPay: Cross-Border Payroll & Remittance for Gig Workers

---

## 1. Executive Summary

StellarPay lets an employer/platform pay gig workers anywhere in the world in USDC and lets workers cash out into local currency in seconds, using Stellar's **path payments** for on-chain FX and the existing **anchor network** (SEP-6/24/31/38) for the fiat off-ramp. The product does not simulate any financial rails — it is a UX layer on top of infrastructure that already exists on Stellar Testnet (Circle's testnet USDC issuer, the SDF reference anchor at `testanchor.stellar.org`, Freighter as the signing wallet).

A Soroban smart contract provides the on-chain payroll ledger (employer registration, worker registration, funding, batch disbursement, audit trail). The actual currency conversion and cash-out happen through classic Stellar operations and SEP flows, orchestrated by the frontend, because **Soroban contracts cannot invoke path payments or the SDEX directly** (see §6.3 for why this matters to the architecture).

---

## 2. Problem Statement

Gig platforms pay international freelancers through wire transfers, PayPal, or Payoneer — 2–5 day settlement, 3–8% in fees and FX spread, and workers in countries with unstable currencies get their pay converted at bad rates and delayed further by local banking hours.

Stellar already has the primitives to fix this: an asset can be issued once (USDC), moved instantly worldwide, atomically converted to another asset via path payment using on-chain liquidity, and redeemed for cash through a regulated anchor — all in the time it takes to load a webpage. Nobody has wrapped this in an approachable payroll UX for gig platforms. That's the gap.

---

## 3. Goals & Non-Goals

### Goals (v1 / hackathon-scope)
- Employer can fund a payroll pool and pay N workers in USDC via a Soroban contract.
- Worker can connect Freighter, view balance/history, and cash out to a "local currency" using an on-chain path payment + a real testnet anchor's SEP-24 interactive withdrawal.
- Entire flow works end-to-end on Testnet, deployed and reachable at a public Cloudflare URL, on first load.

### Non-Goals (explicitly out of scope for v1)
- Mainnet deployment / real money movement.
- Building a new anchor or KYC provider (use `testanchor.stellar.org`, SDF's reference SEP server).
- Automated payroll scheduling/recurring cron payments (can be a "future work" line item).
- Full compliance/KYC/AML implementation — the demo anchor's mocked KYC is sufficient for a testnet PRD.

---

## 4. Users & Personas

| Persona | Need |
|---|---|
| **Employer / Platform Ops** | Register on the app, deposit USDC into a payroll pool, add workers by wallet address, run a payroll batch, see disbursement status & tx hashes. |
| **Gig Worker (Freelancer)** | Connect a wallet (Freighter), see incoming USDC payments in real time, convert to local currency and withdraw to cash via an anchor, see full history. |

---

## 5. Requirement Breakdown (mapped to your list, with acceptance criteria)

| # | Requirement | Acceptance Criteria |
|---|---|---|
| 1 | Connect to Freighter wallet | `isConnected()`, `requestAccess()`/`getAddress()`, `signTransaction()` via `@stellar/freighter-api` wired into a `WalletProvider`; UI shows connect/disconnect state, active network (must be Testnet), and truncated address. Handles "Freighter not installed" and "wrong network" gracefully. |
| 2 | Deploy frontend on Cloudflare (Wrangler set up) | `wrangler.toml` configured for Pages/Workers; `npm run build && wrangler pages deploy dist --project-name=stellarpay` succeeds; live URL added to README. |
| 3 | Deploy contract on testnet, connect to frontend, add contract details to README | `stellar contract deploy` output (Contract ID, WASM hash) captured; frontend `.env`/config references `PUBLIC_CONTRACT_ID`, `PUBLIC_RPC_URL`, `PUBLIC_NETWORK_PASSPHRASE`; README has a "Deployed Contracts" table. |
| 4 | Transaction hash of a contract call | At least one real, verifiable testnet tx hash (from an `invoke_host_function` call) linked in README to StellarExpert, e.g. `https://stellar.expert/explorer/testnet/tx/<hash>`. |
| 5 | Deploy the contract(s) | Payroll contract (and, if used, a thin registry/factory contract) both live on testnet with aliases recorded via `stellar contract deploy --alias`. |
| 6 | Mobile responsive | All core screens (connect, employer dashboard, worker dashboard, cash-out flow) usable at 375px width; verified with Chrome DevTools device emulation + Lighthouse mobile pass. |
| 7 | CI/CD pipeline | GitHub Actions: lint + unit test (frontend & contract) on every PR; on merge to `main`, build frontend and deploy via `cloudflare/wrangler-action@v3`; contract deploy stays a separate, manually-triggered workflow (never auto-redeploy a live contract on every push). |
| 8 | 5+ tests for frontend and contracts | ≥5 Rust `#[test]` cases using `soroban-sdk` `testutils` for the contract; ≥5 Vitest/RTL tests for the frontend (wallet hook, disbursement calculator, cash-out form validation, API/contract client mocks, responsive layout smoke test). |
| 9 | 20+ meaningful commits | Enforced via commit plan in §12 — one logical unit of work per commit, Conventional Commits style, no giant "final version" squash commits. |
| 10 | Seed 55 testnet users interacting with the contract, not committed, not artificially obvious | Seeding script lives outside the repo (or in a `.gitignore`d `/scripts/seed` folder) and is run against testnet directly; see §11 for how to make on-chain activity look organic **and** how to stay honest about it being seed data. |
| 11 | Whole project works first try | Explicit "Definition of Done" checklist in §14 — this is the hardest requirement and the one most projects fail; treat it as a testing/ops problem, not a coding problem. |

---

## 6. System Architecture

### 6.1 High-level components

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

### 6.2 Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | React + Vite (or Next.js static export) | Cloudflare Pages serves static + Workers functions for any light backend logic |
| Styling | Tailwind | Mobile-first breakpoints |
| Stellar SDK | `@stellar/stellar-sdk` (JS) | Handles both classic ops and Soroban contract calls |
| Wallet | `@stellar/freighter-api` (single-wallet, matches your explicit requirement) | Optionally layer `@creit.tech/stellar-wallets-kit` later for multi-wallet support |
| Smart contract | Rust + `soroban-sdk`, compiled to `wasm32v1-none`, deployed via the `stellar` CLI (formerly `soroban-cli`) | Contract ≤64KB WASM size limit |
| Hosting | Cloudflare Pages/Workers via Wrangler | Already set up per your note |
| CI/CD | GitHub Actions + `cloudflare/wrangler-action@v3` | Separate workflow for contract vs frontend deploys |
| Anchor | `testanchor.stellar.org` (SDF reference SEP server) — real infrastructure, not mocked | Supports SEP-1, 6, 10, 12, 24, 31, 38 |
| Bridge asset | Testnet USDC issued by Circle: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | Get funded balances via Circle's testnet faucet or the anchor's SEP-6/24 deposit flow |
| Network passphrase | `Test SDF Network ; September 2015` | |

### 6.3 Why path payments live *outside* the contract (important architectural decision)

Soroban transactions are restricted: a transaction containing an `InvokeHostFunctionOp` **must contain only that one operation** — it cannot be combined with a classic `PathPaymentStrictSend`/`Receive` operation in the same transaction, and Soroban contracts themselves cannot invoke the SDEX, claimable balances, or path payments internally. That means the correct design is two cleanly separated layers, not one "do everything" contract:

- **Layer 1 — On-chain payroll ledger (Soroban contract).** Employer deposits USDC into contract custody (via the built-in Stellar Asset Contract `transfer`), the contract tracks worker balances owed, and a `disburse` call moves USDC from contract custody straight to each worker's Stellar account. This is the auditable "why was this worker paid X" record.
- **Layer 2 — FX + cash-out (classic Stellar ops + SEPs).** Once USDC lands in the worker's wallet, the *worker's own wallet* (via Freighter) submits a classic `path_payment_strict_send` to convert USDC into whatever local-currency anchor asset is needed, immediately followed by a SEP-24 interactive withdrawal request to `testanchor.stellar.org` to redeem that asset for "cash" (simulated bank/mobile-money payout on testnet). These are two sequential, wallet-signed transactions — not bundled into one — surfaced to the user as a single "Cash Out" button/flow so it *feels* atomic even though it isn't at the ledger level.

This distinction matters both for correctness (a reviewer who knows Stellar will immediately check this) and for how you narrate the "path payments + anchors" pitch: the payroll contract is the ledger of record, and path payments/anchors are the off-ramp rail.

---

## 7. Smart Contract Design (Soroban / Rust)

### 7.1 Responsibilities
- Employer registration & authorization (`require_auth`)
- Worker registry per employer
- Payroll pool funding (pulls USDC from employer via SAC `transfer`)
- Batch disbursement (pushes USDC to each worker's account)
- On-chain history/events for auditability
- View functions for frontend (balances, payout history)

### 7.2 Data model (contract storage)

```rust
#[contracttype]
pub enum DataKey {
    Admin,                       // contract admin / employer registry owner
    Employer(Address),           // Employer -> EmployerInfo
    Worker(Address, Address),    // (Employer, Worker) -> WorkerInfo
    PayrollRun(u64),             // run_id -> PayrollRunInfo
    RunCounter,                  // u64
}

#[contracttype]
pub struct EmployerInfo {
    pub usdc_token: Address,     // SAC address for USDC on testnet
    pub pool_balance: i128,
    pub worker_count: u32,
}

#[contracttype]
pub struct WorkerInfo {
    pub total_paid: i128,
    pub last_paid_ledger: u32,
    pub active: bool,
}

#[contracttype]
pub struct PayrollRunInfo {
    pub employer: Address,
    pub total_amount: i128,
    pub worker_count: u32,
    pub timestamp: u64,
}
```

### 7.3 Public interface

```rust
pub fn initialize(env: Env, admin: Address, usdc_token: Address);
pub fn register_employer(env: Env, employer: Address);
pub fn fund_pool(env: Env, employer: Address, amount: i128);           // employer.require_auth(); SAC transfer employer -> contract
pub fn add_worker(env: Env, employer: Address, worker: Address);
pub fn remove_worker(env: Env, employer: Address, worker: Address);
pub fn run_payroll(env: Env, employer: Address, payouts: Vec<(Address, i128)>) -> u64;
                                                                        // SAC transfer contract -> each worker; emits event per payout
pub fn get_pool_balance(env: Env, employer: Address) -> i128;
pub fn get_worker_info(env: Env, employer: Address, worker: Address) -> WorkerInfo;
pub fn get_payroll_run(env: Env, run_id: u64) -> PayrollRunInfo;
```

Key implementation notes:
- Use the **Stellar Asset Contract (SAC)** wrapper for testnet USDC so the same balance is movable both classically (for path payments/anchor withdrawal) and via Soroban `transfer` calls — no wrapping/unwrapping step needed.
- `run_payroll` should emit one event per worker so the frontend can build a per-worker payment history from `getEvents` without a separate indexer.
- Guard every state-changing call with `require_auth()` on the correct principal (employer for funding/payroll, admin for registry changes).

### 7.4 Deployment (reference commands)

```bash
stellar keys generate employer --network testnet --fund
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/payroll_contract.wasm \
  --source-account employer \
  --network testnet \
  --alias payroll
stellar contract invoke \
  --id payroll --source-account employer --network testnet \
  -- initialize --admin <ADMIN_ADDRESS> --usdc_token <USDC_SAC_ADDRESS>
```

Record the resulting Contract ID, WASM hash, and the tx hash from the `initialize` invoke — these three values go straight into the README (see §13).

---

## 8. Frontend Requirements & UX Flows

### 8.1 Screens
1. **Landing / Connect** — value prop, "Connect Freighter" CTA, network check banner.
2. **Employer Dashboard** — pool balance, add/remove workers, "Run Payroll" batch form with per-worker amount, run history table with tx hash links.
3. **Worker Dashboard** — current USDC balance, incoming payment feed (from contract events), "Cash Out" button.
4. **Cash-Out Flow** — pick destination currency → quote via SEP-38 → confirm path payment (Freighter signs) → SEP-24 interactive popup (hosted by `testanchor.stellar.org`) → status polling → success screen with both tx hashes.
5. **Transaction/Contract Explorer link** — every action surfaces a StellarExpert link, not just a raw hash string.

### 8.2 Mobile responsiveness
- Tailwind breakpoints (`sm/md/lg`), test at 375×667 minimum.
- Cash-out flow's SEP-24 popup must fall back to a same-tab redirect on mobile Safari (popups are frequently blocked) — this is a common real-world gotcha, budget time for it.
- Tables (payroll run history) collapse to stacked cards below `md`.

### 8.3 Error states to design explicitly (this is where "works first try" is won or lost)
- Freighter not installed → link to install.
- Wrong network selected in Freighter → one-click "switch to Testnet" instructions.
- Insufficient XLM for fees / no trustline to USDC → auto-offer to establish trustline.
- RPC/Horizon timeout → retry with backoff, don't silently fail.
- Anchor KYC step abandoned mid-flow → resumable, not a dead end.

---

## 9. Non-Functional Requirements

- **Performance:** initial load < 3s on 4G; contract read calls cached client-side for 10–15s to avoid RPC hammering.
- **Security:** never store a secret key client-side; all signing happens in Freighter; contract enforces `require_auth` on every privileged call; rate-limit any Cloudflare Worker endpoints you add.
- **Reliability:** RPC endpoint and anchor URL both configurable via env vars, not hardcoded, so a Testnet outage or anchor URL change doesn't require a redeploy.
- **Accessibility:** basic keyboard navigation + contrast compliance on primary flows.

---

## 10. Testing Strategy

### 10.1 Contract tests (Rust, `cargo test`, `soroban-sdk` testutils) — target 5+
1. `initialize` sets admin & token correctly, cannot be called twice.
2. `register_employer` + `fund_pool` correctly increases pool balance (mock SAC token in test env).
3. `add_worker`/`remove_worker` correctly updates worker registry and rejects unauthorized callers.
4. `run_payroll` distributes exact amounts, updates `total_paid`, and fails atomically if pool balance is insufficient.
5. Auth failure cases: calling `fund_pool` or `run_payroll` without the employer's signature panics as expected (`should_panic` tests).

### 10.2 Frontend tests (Vitest + React Testing Library) — target 5+
1. Wallet hook: renders "Connect" when disconnected, address when connected (mocked `freighter-api`).
2. Payroll form validation: rejects negative/zero amounts, rejects duplicate worker addresses.
3. Cash-out quote component: renders conversion rate/fee breakdown from a mocked SEP-38 response.
4. Contract client: correctly builds and simulates a `run_payroll` invocation against a mocked RPC response.
5. Responsive layout smoke test: dashboard renders without overflow at a mobile viewport width (e.g. via `jsdom` + a CSS/DOM assertion, or a Playwright viewport test if you add e2e).

### 10.3 Optional but recommended
- One Playwright end-to-end test against the deployed testnet contract (connect → fund → pay → view history) run manually/nightly, not on every PR (testnet flakiness).

---

## 11. Testnet Seeding Plan (55 users)

Goal: the contract should show real interaction history — real accounts, real signed transactions, real events — rather than a schema with zero rows, so reviewers see it "alive."

**How to build it correctly:**
1. Generate 55 testnet keypairs with `stellar keys generate` (or the JS SDK's `Keypair.random()`), fund each via Friendbot.
2. Register a handful as employers and the rest as workers across 2–3 simulated "employer" accounts, so the data isn't one employer paying 55 identical amounts.
3. Vary payout amounts, run multiple `run_payroll` batches over time (don't fire all 55 in one script loop in the same second — stagger them; it's also just kinder to the RPC rate limits) and vary which workers get paid in which run, so the on-chain history shows natural-looking variety rather than one uniform loop.
4. Have some of the seeded worker accounts actually execute the path-payment + SEP-24 cash-out flow against `testanchor.stellar.org`, not just receive USDC — that's what proves the *whole* pipeline works, not just the contract.
5. Keep the seeding script in a local/CI-only location excluded from the repo (or gitignored) — that's a completely reasonable choice for key material and to keep the repo focused on product code, not a one-off data script.

**One honesty note, worth building in now rather than fixing later:** seeded data is a completely standard and expected part of a testnet demo — every serious Stellar hackathon project does this. Where it crosses from "normal demo prep" into "misleading," though, is if you present this activity *as if* it were organic user adoption to judges, investors, or in the README (e.g., "55 active users on our platform"). The safer and just-as-effective framing is to be upfront about it: a line in the README like *"Testnet seeded with 55 synthetic worker/employer accounts across N payroll runs to demonstrate the full payment lifecycle"* costs you nothing in how impressive the demo looks, and it's the difference between "well-prepared demo" and a claim that could unravel under a reviewer's questions (most Stellar/Soroban judges will check StellarExpert and will notice 55 accounts created in one block versus organically over days).

---

## 12. Git & Commit Strategy (20+ meaningful commits)

Structure work so each commit is a real, reviewable unit — this also naturally produces 20+ commits without padding:

1. `chore: scaffold repo (frontend + contracts workspace)`
2. `feat(contract): initialize + admin/employer data model`
3. `test(contract): initialize tests`
4. `feat(contract): register_employer + fund_pool`
5. `test(contract): fund_pool tests`
6. `feat(contract): worker registry (add/remove)`
7. `feat(contract): run_payroll disbursement logic`
8. `test(contract): run_payroll + auth failure tests`
9. `chore: deploy contract to testnet, record contract id`
10. `feat(frontend): scaffold Vite/React app + Tailwind`
11. `feat(frontend): Freighter wallet connect hook`
12. `feat(frontend): contract client (stellar-sdk wiring)`
13. `feat(frontend): employer dashboard UI`
14. `feat(frontend): worker dashboard UI`
15. `feat(frontend): cash-out flow (path payment + SEP-24)`
16. `test(frontend): wallet hook + form validation tests`
17. `test(frontend): contract client + cash-out quote tests`
18. `style: mobile responsive pass`
19. `chore: wrangler.toml + Cloudflare deploy config`
20. `ci: github actions — lint/test on PR`
21. `ci: github actions — deploy frontend on merge to main`
22. `docs: README with contract details, tx hash, setup instructions`
23. `fix: <real bug found during first-try QA pass>`
24. `chore: testnet seed script (local-only, gitignored) + .gitignore update`

Avoid: multiple "wip", "fix", "final" commits with no description, and never squash everything into one commit at the end to hit the number — reviewers can see through that immediately.

---

## 13. README Requirements

The README must include:
- **Deployed Contracts** table: Contract ID, WASM hash, network, `stellar contract deploy` alias.
- **Example transaction**: at least one real tx hash + StellarExpert link (e.g. `https://stellar.expert/explorer/testnet/tx/<hash>`).
- **Live frontend URL** (Cloudflare Pages).
- **Local setup**: env vars needed (`PUBLIC_CONTRACT_ID`, `PUBLIC_RPC_URL`, `PUBLIC_NETWORK_PASSPHRASE`, `PUBLIC_ANCHOR_HOME_DOMAIN`), install/build/run commands.
- **Architecture diagram** (§6.1 reused).
- **Testing**: how to run contract and frontend tests.
- **Seed data disclosure** line (§11).
- **Known limitations**: testnet only, mocked KYC via reference anchor, etc.

---

## 14. CI/CD Pipeline

- **On every PR:**
  - `cargo test` (contract workspace)
  - `npm run lint && npm run test` (frontend)
  - `npm run build` (fail the PR if the production build breaks — this single check prevents most "works on my machine" first-try failures)
- **On merge to `main`:**
  - Rebuild frontend, deploy via `cloudflare/wrangler-action@v3` (`command: pages deploy dist --project-name=stellarpay`), using `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets.
- **Contract deploys are a separate, manually-triggered workflow** (`workflow_dispatch`) — you do not want a routine frontend PR merge to accidentally redeploy/replace a live contract ID that the frontend and README already reference.

---

## 15. "Works on First Try" — Definition of Done

Since requirement #11 is non-negotiable, treat it as its own workstream, not an assumption:

- [ ] Fresh clone, fresh `npm install`, `npm run build` succeeds with zero manual fixes.
- [ ] Deployed Cloudflare URL loads with no console errors on both desktop and a real mobile device (not just DevTools emulation).
- [ ] Freighter connect flow tested in an actual browser with the actual extension installed, on a machine that has never used the app before (ask a friend, or use a clean browser profile).
- [ ] Contract ID / RPC URL / network passphrase in the deployed frontend match exactly what's in the README — a stale env var after a redeploy is the single most common reason these demos break.
- [ ] Full happy path (connect → fund → pay → cash out) run end-to-end against the live deployment, not just localhost, right before submission.
- [ ] Testnet liveness check: confirm the contract isn't archived (Soroban testnet contracts can be archived after inactivity) within 24 hours of demo/submission — redeploy or extend TTL if needed.
- [ ] Anchor dependency check: confirm `testanchor.stellar.org` is reachable the day of the demo (it's SDF-run infra you don't control — have a fallback screen-recording of the cash-out flow in case it's down).

---

## 16. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Soroban testnet contract gets archived from inactivity before demo | Re-invoke a lightweight read call periodically, or redeploy right before submission and re-run seed script |
| `testanchor.stellar.org` downtime on demo day | Record a video of a successful cash-out as backup evidence |
| Freighter extension not installed on judge's/reviewer's machine | Clear install prompt + a recorded walkthrough video linked in README |
| Popup blockers breaking SEP-24 interactive flow on mobile | Same-tab redirect fallback (§8.2) |
| Seed script accidentally committed (exposes 55 testnet secret keys) | `.gitignore` the seed script/output directory from day one; testnet keys are low-stakes but still don't belong in git history |
| Reviewer questions the "55 users" as inflated traction | Disclosed seed-data line in README (§11) — costs nothing, avoids credibility risk |

---

## 17. Suggested Timeline (solo/small team, hackathon-paced)

| Days | Focus |
|---|---|
| 1 | Contract: data model, `initialize`, `register_employer`, `fund_pool` + tests |
| 2 | Contract: worker registry, `run_payroll` + tests; deploy to testnet |
| 3 | Frontend scaffold, Freighter connect, contract client wiring |
| 4 | Employer dashboard + Worker dashboard |
| 5 | Cash-out flow: SEP-38 quote → path payment → SEP-24 interactive |
| 6 | Mobile responsive pass, CI/CD, Cloudflare deploy |
| 7 | Seed script, README, first-try QA pass, buffer for the inevitable Freighter/anchor edge case |

---

## Appendix A — Key Testnet Reference Values

- Network passphrase: `Test SDF Network ; September 2015`
- Soroban RPC: `https://soroban-testnet.stellar.org`
- Horizon: `https://horizon-testnet.stellar.org`
- Friendbot: `https://friendbot.stellar.org`
- Testnet USDC (Circle) issuer: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
- Reference anchor: `https://testanchor.stellar.org` (SEP-1 `.well-known/stellar.toml`, SEP-6/24/31/38 endpoints all live under this domain)
- Explorer: `https://stellar.expert/explorer/testnet`

## Appendix B — Suggested Repo Structure

```
/contracts
  /payroll
    src/lib.rs
    Cargo.toml
/frontend
  src/
    components/
    hooks/          (useWallet, useContract)
    lib/            (stellar client, sep helpers)
  wrangler.toml
/scripts            (gitignored: seed data, deploy helpers with local keys)
.github/workflows/
  ci.yml
  deploy-frontend.yml
  deploy-contract.yml   (workflow_dispatch only)
README.md
```