# Settlement & Dispute — Developer Guide

This guide gets a **Pinocchio newcomer** from zero to running the escrow program's
tests, including the new two-party **Settlement / Dispute** feature
(`SetSettlement`, `Approve`, `RaiseDispute`, `Resolve`). Full design: `docs/DISPUTS.md`.

---

## 1. Prerequisites

| Tool | Version | Why |
|---|---|---|
| Rust toolchain | **1.92** (see `rust-toolchain.toml`) | Compiles the program + unit tests. Provides `cargo`. |
| Solana CLI / `cargo-build-sbf` | **Agave 3.x** (platform-tools rustc ≥ 1.85) | Compiles the program to the SBF `.so` the LiteSVM tests load. |
| Node.js + `pnpm` | LTS / 11.x | Runs Codama to regenerate IDL + Rust/TS clients. |
| `just` (optional) | any | Convenience runner (`justfile`). All commands below also work without it. |

### ⚠️ Toolchain caveat (important)

The program compiles with the system `cargo` (1.92) regardless. But building the SBF
`.so` via `cargo-build-sbf` uses a **bundled** platform-tools toolchain. A transitive
build-dependency (`toml_datetime`) requires Rust `edition2024` (stabilized in 1.85).

If your bundled platform-tools is rustc **1.84 or older** you will hit:

```
error: feature `edition2024` is required ... not stabilized in this version of Cargo (1.84.0)
```

**Fix:** install a current Agave CLI so `cargo-build-sbf` pulls platform-tools with
rustc ≥ 1.85:

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
# or pin a specific Agave release, then:
cargo-build-sbf --version    # confirm platform-tools rustc >= 1.85
```

The repo's `Cargo.toml` targets `solana = "3.1.10"`; match that channel if you can.

---

## 2. One-time setup

From the repo root:

```bash
# 1. Rust toolchain (pinned by rust-toolchain.toml — automatic)
rustc --version            # expect 1.92.x

# 2. JS tooling for client generation
pnpm install

# 3. Build everything: regenerate IDL + clients, build the program .so + test-hook .so
just build
# Without `just`, run the steps manually (see justfile):
#   pnpm run generate-idl        # cd program && cargo check --features idl  -> idl/escrow_program.json
#   pnpm run generate-clients    # tsx scripts/generate-clients.ts          -> clients/{rust,typescript}
#   (cd tests/test-hook-program && cargo-build-sbf --features allow && cp ../target/deploy/test_hook_program.so ../target/deploy/test_hook_allow.so)
#   (cd tests/test-hook-program && cargo-build-sbf --features deny  && cp ../target/deploy/test_hook_program.so ../target/deploy/test_hook_deny.so)
#   (cd program && cargo-build-sbf)
```

After this you should have:

```
target/deploy/escrow_program.so
target/deploy/test_hook_allow.so
target/deploy/test_hook_deny.so
idl/escrow_program.json
clients/rust/src/generated/instructions/{set_settlement,approve,raise_dispute,resolve}.rs
```

---

## 3. Running the tests

There are **two** test layers. Run them separately:

### 3a. Unit tests (pure Rust, no Solana toolchain needed)

Fast in-process tests of data structs, discriminators, events, and the settlement
extension serialization:

```bash
cargo test -p escrow-program
# or: just unit-test
```

These cover: `SettlementData` round-trip, verdict classification, instruction-data
parsing, error-code mapping, and the new instruction discriminators (13–16).

### 3b. Integration tests (LiteSVM — needs the `.so` from §2)

Full end-to-end behaviour: build the instruction, execute against an in-process
Solana VM, assert on-chain state (token balances, account closure, error codes).

```bash
cargo test -p tests-escrow-program
# or: just integration-test

# A single test file / test:
cargo test -p tests-escrow-program test_set_settlement
cargo test -p tests-escrow-program test_cooperative_release_on_second_approval

# Everything (build + unit + integration):
just test
```

With a compute-unit report:

```bash
just test-and-benchmark      # writes cu_report.md
```

---

## 4. What the Settlement tests verify

`tests/integration-tests/src/test_settlement_flows.rs` exercises the whole lifecycle:

| Test | Scenario | Expected outcome |
|---|---|---|
| `test_cooperative_release_on_second_approval` | buyer `Approve`, then seller `Approve` | funds → beneficiary, receipt closed |
| `test_dispute_verdict_releases_to_beneficiary` | `RaiseDispute`, verdict `== release_value`, `Resolve` | funds → beneficiary |
| `test_dispute_verdict_refunds_depositor` | `RaiseDispute`, verdict = refund byte, `Resolve` | funds → depositor |
| `test_dispute_pending_verdict_errors` | verdict `== 255` | `Resolve` fails `DisputePending` (18); funds untouched |
| `test_withdraw_blocked_while_disputed` | `RaiseDispute`, then `Withdraw` | `Withdraw` fails `EscrowDisputed` (17) |
| `test_raise_dispute_rejects_wrong_owner_pda` | PDA not owned by `dispute_program` | `RaiseDispute` fails `InvalidDisputePda` (21) |

`test_set_settlement.rs` covers the instruction's account/data validation
(missing admin signer, wrong system/escrow program, bad bump, empty/truncated data,
`release_value == 255` rejection, success).

### Why no separate "dispute program" binary in tests

The escrow performs an **ownership-only** check on the verdict PDA
(`verdict_pda.owner() == dispute_program`) — it never CPIs the dispute program. So
the tests inject a verdict account owned by a fixed pubkey (`TEST_DISPUTE_PROGRAM`)
directly into the LiteSVM (`ctx.svm.set_account`). That faithfully exercises the
escrow's logic without building a second program.

---

## 5. Quick architecture recap

Added (additive — only one existing instruction, `Withdraw`, gains a ~6-line gate):

- **Extension** `Settlement` (type 4): `program/src/state/extensions/settlement.rs`
- **Instructions** (disc 13–16): `program/src/instructions/settlement/{set_settlement,approve,raise_dispute,resolve}/`
- **Withdraw gate**: `program/src/instructions/withdraw/processor.rs` — blocks refund while `disputed`
- **Events**: `SettlementConfiguredEvent`, `DisputeRaisedEvent`, `ReleaseEvent` (`program/src/events/settlement.rs`)
- **Errors** 17–25: `program/src/errors.rs`
- **IDL**: `program/src/instructions/definition.rs` (regenerated into `clients/`)

See `docs/DISPUTS.md` §15 for the full file-level change map and §9 for the
trust-boundary note on verdict-PDA binding (the dispute program's responsibility).
