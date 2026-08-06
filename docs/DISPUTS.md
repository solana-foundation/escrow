# Escrow — Dispute & Settlement Specification

> Status: **spec (pre-implementation)**. Framework: **Pinocchio**. Testing: **LiteSVM**
> (mirrors `tests/integration-tests` + `tests/test-hook-program`). Risk: **🔴 Critical**
> (vault custody + verdict oracle + irreversible fund release).
>
> This document specifies a **minimal, additive** change to the audited escrow program
> that turns it into a true two-party escrow: buyer (depositor) and seller (beneficiary),
> with cooperative async approval and an escape into dispute adjudication.

---

## 1. Goal

Add a second payout party (the **beneficiary** / seller) and two resolution modes:

1. **Cooperative (async)** — both parties sign off separately; on the second approval the
   funds release to the beneficiary automatically.
2. **Disputed** — either party locks the escrow; from then on **only a verdict read from an
   owner-checked PDA** can move the funds, to either party.

The buyer's pre-dispute exit is the existing `Withdraw` (optionally timelock-gated). Once a
dispute is raised, that exit is **blocked** — the verdict is the sole exit. The `Timelock`
extension remains **optional** (see §12.1).

## 2. Scope & non-goals

**In scope (escrow program):**
- One new TLV extension (`Settlement`).
- Four new instructions: `SetSettlement`, `Approve`, `RaiseDispute`, `Resolve`.
- One **additive** check in `Withdraw` (block refund while disputed).

**Explicitly OUT of scope (escrow program does NOT do these):**
- ❌ Create disputes, store evidence, or run any adjudication logic.
- ❌ Re-derive / seed-check the dispute program's verdict PDA.
- ❌ Identify which escrow a dispute corresponds to. **This is the dispute program's
  responsibility** — it binds its verdict PDA to the correct escrow from the disputed
  evidence via its own PDA seeds. The escrow trusts that binding (see §9).
- ❌ Multi-receipt settlement. State is **per-escrow** and assumes the one-receipt
  two-party trade (see §12).

## 3. Actors & trust model

| Actor | Identity source | Powers |
|---|---|---|
| Depositor (buyer) | `receipt.depositor` | `Approve` (buyer flag), `RaiseDispute`, timelock `Withdraw` (pre-dispute) |
| Beneficiary (seller) | `SettlementData.beneficiary` | `Approve` (seller flag), `RaiseDispute` |
| Dispute program | `SettlementData.dispute_program` (pinned at setup) | Sole writer of the verdict PDA; write-once |
| Relayer (anyone) | — | May submit `Resolve` (permissionless) |

**Trust boundary:** the escrow trusts exactly one fact about the dispute PDA — that it is
**owned by the configured `dispute_program`**. Everything else (PDA↔escrow binding,
verdict correctness, finality) is the dispute program's contract.

## 4. State machine

```
                         deposit → receipt
                               │
                               ▼
              ┌──────── COOPERATIVE (async) ─────────┐
              │  buyer_approved / seller_approved     │
   Approve ───►  (each party signs off separately)    │   RaiseDispute
              │                                       │ ──────────────►
              │  both set & !disputed → RELEASE       │  (depositor OR beneficiary)
              │  vault→beneficiary, close receipt     │
              └───────────────────────────────────────┘
                                                        ┌── DISPUTED (one-way / absorbing) ──┐
                                                        │ Withdraw(timelock):  BLOCKED   ◄─── │ only existing-behavior change
                                                        │ Approve:             BLOCKED        │
                                                        │ Resolve(verdict):                   │
                                                        │   v == release_value → vault→seller │
                                                        │   v == 255 (pending)  → Err         │
                                                        │   else                → vault→buyer │
                                                        │   close receipt either way          │
                                                        └─────────────────────────────────────┘
```

- Cooperative payout → **beneficiary** (seller). This is the only path that pays the seller
  without a verdict.
- Verdict payout branches to seller **or** buyer.
- Every payout branch **closes the receipt** → single-use, no double-claim.
- `DISPUTED` is **absorbing** (§26.7): no transition back to cooperative; only `Resolve`.

## 5. New extension: `SettlementData`

New `ExtensionType::Settlement = 4` (append to the enum in `state/escrow_extensions.rs:14-19`
and its `TryFrom<u16>` at `:21-33`). Mirrors `ArbiterData`/`HookData`:
`#[repr(C)]` + `assert_no_padding!` + `impl ExtensionData`. Written via the existing
`update_or_append_extension`; read via `get_extensions_from_account`.

| Field | Type | Set by | Semantics |
|---|---|---|---|
| `beneficiary` | `Pubkey` | `SetSettlement` (admin) | Seller / payout target |
| `dispute_program` | `Pubkey` | `SetSettlement` (admin) | Trusted owner of any verdict PDA |
| `release_value` | `u8` | `SetSettlement` (admin) | Verdict byte meaning "pay seller". **Must be ≠ 255.** |
| `buyer_approved` | `bool` | `Approve` | Depositor async sign-off (one-way) |
| `seller_approved` | `bool` | `Approve` | Beneficiary async sign-off (one-way) |
| `disputed` | `bool` | `RaiseDispute` | Lock flag, one-way |
| `dispute_pda` | `Pubkey` | `RaiseDispute` | Verdict account, supplied by raiser; zeroed until raised |
| `offset` | `u16` | `RaiseDispute` | Byte offset of verdict in `dispute_pda`; `0` until raised |

**Constants:**
- `VERDICT_PENDING: u8 = 255` — sentinel; never a valid `release_value`.

**`SetSettlement` validations:** `release_value != 255`; `beneficiary != depositor`
(reject degenerate self-trade — depositor read from the receipt passed in, or require
admin != beneficiary where admin is the configuring party).

## 6. Instructions

All four are **net-new**; none modifies an existing instruction path. Account layout
follows the `withdraw/accounts.rs` `TryFrom<&[AccountView]>` + `verify_*` convention.

### 6.1 `SetSettlement` (admin) — clone of `SetArbiter`

Writes `{ beneficiary, dispute_program, release_value }` with all flags `false`,
`dispute_pda = zero`, `offset = 0`.

**Accounts:** `payer`(w,s) · `admin`(s, ==escrow.admin) · `escrow` · `extensions`(w) ·
`system_program` · `event_authority` · `escrow_program`
**Data:** `extensions_bump: u8`, `beneficiary: Pubkey`, `dispute_program: Pubkey`, `release_value: u8`
**Guards:** `require_mutable()` (configurable until immutable, like other extensions).
**Event:** `SettlementConfiguredEvent`.

### 6.2 `Approve` (depositor OR beneficiary) — async approval + auto-release

**Accounts:** `signer`(s) · `escrow` · `extensions`(w) · `receipt`(w) · `vault`(w) ·
`beneficiary_token_account`(w) · `mint` · `token_program` · `system_program` ·
`event_authority` · `escrow_program`
**Data:** none.
**Logic:**
1. Load `Settlement`; require `!disputed` (`Err(AlreadyDisputed)`).
2. Identify signer: `signer == receipt.depositor` → set `buyer_approved`; `signer == Settlement.beneficiary` → set `seller_approved`; else `Err(InvalidAdmin)`-style.
3. Persist the flag.
4. If now `buyer_approved && seller_approved` → **cooperative release** in the same tx:
   `validate_associated_token_account(beneficiary_token_account, beneficiary, mint, token_program)`;
   `TransferChecked vault→beneficiary_token_account` (escrow PDA signs via `with_signer`);
   `close_pda_account(receipt, …)`; emit `ReleaseEvent { recipient: beneficiary }`.
**Approvals are one-way** (set-only; no un-approve) — minimal + no grief via flip-flop.

### 6.3 `RaiseDispute` (depositor OR beneficiary) — the lock

**Accounts:** `signer`(s) · `escrow` · `extensions`(w) · `receipt` · `dispute_pda`(ro) ·
`system_program` · `event_authority` · `escrow_program`
**Data:** `offset: u16`
**Logic:**
1. Load `Settlement`; require `!disputed` (`Err(AlreadyDisputed)`).
2. Authorize: `signer == receipt.depositor` **or** `signer == Settlement.beneficiary`.
3. **Ownership pin:** `dispute_pda.owner() == Settlement.dispute_program` else `Err(InvalidDisputePda)`.
4. Bounds pre-check (best-effort): `offset < dispute_pda.data_len()` else `Err(VerdictOutOfBounds)`.
5. Store `dispute_pda`, `offset`; set `disputed = true`. **One-way.**
**Event:** `DisputeRaisedEvent { dispute_pda, offset }`.

### 6.4 `Resolve` (permissionless) — verdict-driven payout

**Accounts:** `payer`(s) · `rent_recipient`(w) · `escrow` · `extensions` · `receipt`(w) ·
`vault`(w) · `depositor_token_account`(w) · `beneficiary_token_account`(w) ·
`dispute_pda`(ro) · `mint` · `token_program` · `system_program` · `event_authority` ·
`escrow_program`
**Data:** none (verdict source is the stored `dispute_pda`/`offset`).
**Logic:**
1. Load `Settlement`; require `disputed` (`Err(NotDisputed)`).
2. Require `dispute_pda.key() == Settlement.dispute_pda` (anti-swap) **and**
   `dispute_pda.owner() == Settlement.dispute_program` (defense-in-depth).
3. `let v = dispute_pda.data()[offset]` after `offset < data.len()` (`Err(VerdictOutOfBounds)`).
4. Branch:
   - `v == release_value` → dest = `beneficiary_token_account` (ATA of `beneficiary`).
   - `v == 255` → `Err(DisputePending)`.
   - else → dest = `depositor_token_account` (ATA of `receipt.depositor`).
5. `TransferChecked vault→dest` (escrow PDA signs); `close_pda_account(receipt, rent_recipient)`.
6. Emit `ReleaseEvent { recipient: <winner> }` or distinct `ResolveEvent`.

Both possible destination ATAs are passed so the instruction is deterministic regardless of
which branch the verdict selects.

## 7. Existing-behavior change: `Withdraw` disputed-gate (the ONLY one)

In `process_withdraw` (`instructions/withdraw/processor.rs`), extend the existing
extension fetch and add one gate. Nothing else in `Withdraw` changes.

```rust
// was:
let exts = get_extensions_from_account(
    ix.accounts.extensions,
    &[ExtensionType::Timelock, ExtensionType::Hook, ExtensionType::Arbiter],
)?;
// becomes:
let exts = get_extensions_from_account(
    ix.accounts.extensions,
    &[ExtensionType::Timelock, ExtensionType::Hook, ExtensionType::Arbiter, ExtensionType::Settlement],
)?;

// NEW — block buyer refund while a dispute is open:
if let Some(ref b) = exts[3] {
    if SettlementData::from_bytes(b)?.disputed {
        return Err(EscrowProgramError::EscrowDisputed.into());
    }
}
```

Pre-dispute, `Withdraw` is byte-for-byte identical to today. The timelock/hook/arbiter
logic is untouched.

## 8. Verdict semantics (tri-state)

The escrow reads exactly one byte at `Settlement.offset` from `Settlement.dispute_pda`:

| Byte value | Outcome |
|---|---|
| `== release_value` | Pay **seller** (`vault → beneficiary_token_account`) |
| `== 255` (`VERDICT_PENDING`) | `Err(DisputePending)` — dispute not yet resolved |
| anything else | Pay **buyer** (`vault → depositor_token_account`) |

The verdict is **write-once** (dispute program contract). The escrow never writes it and
does not care how the dispute program computes it.

## 9. Verdict PDA & pinning — the trust boundary

The escrow performs **exactly one** check on the verdict account:

> `dispute_pda.owner() == SettlementData.dispute_program`  (configured at setup)

It does **not** re-derive the PDA, does not know the dispute program's seeds, and runs no
dispute logic. Raiser supplies `dispute_pda` + `offset` at `RaiseDispute`; the escrow stores
them and reads them back at `Resolve`.

**Security implication (must be flagged in the checklist):** because the escrow does not
seed-bind the verdict PDA, **the dispute program must seed its verdict PDA by escrow
identity (and, for multi-receipt safety, by receipt)**. A dispute program that issues a
verdict PDA *not* bound to this escrow enables **cross-escrow verdict replay**: a raiser
could point `dispute_pda` at another dispute's (legitimately-owned, favorable) verdict PDA.
Mitigation is entirely on the dispute-program side; the escrow cannot close it without
importing custom logic (explicitly out of scope per design).

**Defense-in-depth already included:** `Resolve` re-checks ownership and requires the
passed `dispute_pda` to equal the one stored at `RaiseDispute` (no post-raise swap).

## 10. New error variants (`errors.rs`)

| Code | Name | When |
|---|---|---|
| 17 | `EscrowDisputed` | `Withdraw`/`Approve` attempted while `disputed` |
| 18 | `DisputePending` | `Resolve` read verdict `== 255` |
| 19 | `AlreadyDisputed` | `RaiseDispute`/`Approve` after `disputed` |
| 20 | `NotDisputed` | `Resolve` before any dispute |
| 21 | `InvalidDisputePda` | `dispute_pda.owner() != dispute_program` |
| 22 | `VerdictOutOfBounds` | `offset >= dispute_pda.data_len()` |
| 23 | `SettlementNotConfigured` | settlement instruction with no `Settlement` extension |

## 11. Security checklist (Frank Castle lens)

- **§1.2/§1.4 ownership & type-cosplay:** verdict PDA owner-checked against pinned
  `dispute_program`; all new accounts validated (signer/writable/owner) per the
  `verify_*` convention.
- **§4 duplicate mutable accounts:** `depositor_token_account != beneficiary_token_account`
  (reject same-key; `beneficiary != depositor` enforced at `SetSettlement`).
- **§5 CPI:** none introduced — `Resolve`/`Approve` are direct reads + `TransferChecked`.
  No stale-data risk (no post-CPI reads).
- **§6.3 / §26.7 account close & absorbing state:** every payout closes the receipt
  (zero→lamports→system) exactly as `Withdraw` does; `DISPUTED` is absorbing
  (`RaiseDispute` requires `!disputed`; `Approve` requires `!disputed`).
- **§22.1 withdrawal path:** the vault gains its beneficiary withdrawal path (`Approve`/
  `Resolve`) — net positive.
- **§24.2 admin rotation:** out of scope here, but flag — existing `update_admin` is
  single-step; recommend two-step + timelock for a Critical custodial escrow (future work).
- **§29.2 user-controlled release gates:** the verdict config (`dispute_program`,
  `release_value`) is admin-set, not user-controlled; `offset`/`dispute_pda` are
  raiser-supplied but owner-pinned — acceptable.
- **Replay / double-spend:** receipt single-use (closed on every payout); approvals one-way.
- **Stuck-funds dependency:** if the verdict is never written (stays `255` forever) the
  escrow is permanently locked. Inherent to "dispute is the only exit." The dispute program
  owns eventual resolution — hard dependency, documented.

## 12. Preconditions & limitations

1. **`Timelock` is OPTIONAL — not required for correctness.** Its sole role is to give the
   seller a *deterministic, non-racy* window to `RaiseDispute` a non-cooperating buyer: with
   a timelock the buyer cannot `Withdraw` until *T*, so the seller holds the interval
   [deposit, *T*] to lock. Without a timelock, locking a stiffing buyer is a pure pre-dispute
   landing race (buyer-`Withdraw` vs seller-`RaiseDispute`), and the buyer may reclaim their
   own still-unreleased funds at any time. Both modes are valid; the deployer chooses
   per-escrow. We **recommend** (not enforce) a timelock for high-value trades where that race
   is uncomfortable. Consistent with `Timelock` already being an optional extension.
2. **Per-escrow state = one-receipt model.** `disputed`/approval flags are per-escrow, so a
   dispute freezes **every** depositor in that escrow. Correct for the 1-buyer/1-seller
   trade; wrong for a multi-buyer marketplace. Multi-receipt isolation requires per-receipt
   PDAs (future work).
3. **Escrow-stuck-if-never-resolved** — see §11.
4. **No `unlock`** — disputes resolve only via `Resolve`.

## 13. Testing plan (LiteSVM)

Mirror `tests/integration-tests` + `tests/test-hook-program`:

- **Fixtures:** `set_settlement`, `approve`, `raise_dispute`, `resolve`, plus a
  `mock-dispute-program` (Pinocchio, like `test-hook-program`) that owns a verdict PDA it
  writes write-once — used to inject `release_value` / `255` / refund-byte verdicts.
- **Happy paths:**
  - Cooperative: both `Approve` → beneficiary paid, receipt closed, CU logged.
  - Dispute→seller: `RaiseDispute` (owner-checked PDA) → `Resolve` with `release_value` →
    beneficiary paid.
  - Dispute→buyer: `Resolve` with refund-byte → depositor paid.
- **Security/edge (assert `is_err`):**
  - `Withdraw` after `disputed` → `EscrowDisputed`.
  - `Approve` after `disputed` → `AlreadyDisputed`.
  - `RaiseDispute` with PDA owned by wrong program → `InvalidDisputePda`.
  - `Resolve` before dispute → `NotDisputed`; verdict `255` → `DisputePending`;
    `offset` OOB → `VerdictOutOfBounds`.
  - `dispute_pda` swap at `Resolve` (≠ stored) → rejected.
  - `release_value == 255` at `SetSettlement` → rejected.
  - Second `Approve` after release (receipt closed) → fails.
- **CU:** record via existing `cu_tracker`; add a `zz_cu_summary`-style aggregate.

## 14. Open items (block implementation)

- **Verdict PDA schema confirmation:** seeds (escrow/receipt binding), exact `offset`, and
  write-once guarantee are the dispute program's contract. The escrow needs only
  `owner == dispute_program` + the raiser-supplied `offset`; confirm the dispute program
  seeds by escrow identity (§9 replay mitigation).
- **Decide:** distinct `ResolveEvent` vs overload `ReleaseEvent` with a `recipient` field.

## 15. File-level change map (concrete delta)

| File | Change |
|---|---|
| `state/escrow_extensions.rs` | `ExtensionType::Settlement = 4` + `TryFrom<u16>` arm |
| `state/extensions/settlement.rs` | **new** — `SettlementData` (`#[repr(C)]`, `assert_no_padding!`, `impl ExtensionData`) + verdict-read helper |
| `state/extensions/mod.rs` | `pub mod settlement; pub use settlement::*;` |
| `instructions/settlement/` | **new** — `set_settlement/`, `approve/`, `raise_dispute/`, `resolve/` (each `data.rs`+`accounts.rs`+`processor.rs`+`mod.rs`, mirroring `set_arbiter`/`withdraw`) |
| `instructions/mod.rs` / `definition.rs` | register 4 new instructions + discriminators + impl dispatch |
| `instructions/withdraw/processor.rs` | the §7 disputed-gate (additive; ~6 lines) |
| `events/` | `SettlementConfiguredEvent`, `DisputeRaisedEvent`, `ReleaseEvent`/`ResolveEvent` |
| `errors.rs` | variants §10 |
| `docs/PROGRAM_OVERVIEW.md` | add the 4 instructions, `Settlement` extension, new error codes |
| `tests/` | fixtures + tests per §13; new `mock-dispute-program` crate |
