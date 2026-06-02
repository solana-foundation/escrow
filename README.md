# Escrow Program

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Built with Pinocchio](https://img.shields.io/badge/Built%20with-Pinocchio-purple)](https://github.com/anza-xyz/pinocchio)
[![Solana](https://img.shields.io/badge/Solana-Devnet-green)](https://solana.com)

## Program ID

```
Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg
```

## Deployments

| Network                                                                                                   | Program ID                                     |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [Devnet](https://explorer.solana.com/address/Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg?cluster=devnet) | `Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg` |

## Overview

A configurable escrow program for Solana that enables receipt-based token deposits and withdrawals. Admins create escrows and allowlist specific mints, while depositors receive receipts that can be redeemed after optional lock mechanisms (e.g., timelocks, hooks, etc.) are satisfied.

## Key Features

- **Receipt-based deposits** - Each deposit creates a unique receipt PDA for tracking
- **Per-escrow mint allowlisting** - Admins control which tokens can be deposited
- **Token-2022 extension blocking** - Optionally block mints with specific extensions (PermanentDelegate, NonTransferable, Pausable, etc.)
- **Configurable timelocks** - Set lock durations that must pass before withdrawals
- **Custom hook programs** - Invoke external programs pre/post deposit and withdrawal

## Hook Warning

If a hook is configured and the escrow is later made immutable, that hook configuration becomes permanent.

- The hook cannot be changed or removed after immutability is set.
- Hook callbacks run at all four hook points: PreDeposit, PostDeposit, PreWithdraw, PostWithdraw.
- Any hook revert aborts the escrow instruction.
- A buggy or malicious hook can permanently block deposit and/or withdraw flows.

## Account Types

| Account          | PDA Seeds                                            | Description                                                 |
| ---------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| Escrow           | `["escrow", escrow_seed]`                            | Main escrow config (admin, bump)                            |
| Receipt          | `["receipt", escrow, depositor, mint, receipt_seed]` | Deposit record with amount and timestamp                    |
| AllowedMint      | `["allowed_mint", escrow, mint]`                     | Marker that a mint is allowed                               |
| EscrowExtensions | `["extensions", escrow]`                             | TLV-encoded extensions (timelock, hook, blocked extensions) |

## Workflow

```mermaid
sequenceDiagram
    participant Admin
    participant Program
    participant Accounts

    Admin->>Program: CreatesEscrow
    Program->>Accounts: create Escrow PDA

    Admin->>Program: AllowMint
    Program->>Accounts: create AllowedMint PDA + Vault

    Admin-->>Program: AddTimelock (optional)
    Program-->>Accounts: create Extensions PDA

    Admin-->>Program: SetHook (optional)
    Program-->>Accounts: create Extensions PDA
```

```mermaid
sequenceDiagram
    participant Depositor
    participant Program
    participant Accounts

    Depositor->>Program: Deposit
    Program->>Accounts: transfer to Vault
    Program->>Accounts: create Receipt PDA

    Note over Depositor,Accounts: timelock passes

    Depositor->>Program: Withdraw
    Program->>Accounts: verify Receipt
    Program->>Accounts: verify Hooks
    Program->>Depositor: transfer tokens
    Program->>Accounts: close Receipt
```

## Documentation

- [Program Overview](docs/PROGRAM_OVERVIEW.md) - Instructions, accounts, and technical reference
- [CU Benchmarks](docs/CU_BENCHMARKS.md) - Compute unit usage per instruction
- [Improvements](docs/IMPROVEMENTS.md) - Possible future enhancements

## Local Development

### Prerequisites

- Rust
- Node.js (see `.nvmrc`)
- pnpm (see `package.json` `packageManager`)
- Solana CLI

All can be conveniently installed via the [Solana CLI Quick Install](https://solana.com/docs/intro/installation).

### Client Examples

Check out the [TypeScript demo](examples/typescript/escrow-demo/README.md) for a complete example of the escrow program in action.

### Build & Test

```bash
# Install dependencies
just install

# Full build (IDL + clients + program)
just build

# Run integration tests
just integration-test

# Format and lint
just fmt
```

## Tech Stack

- **[Pinocchio](https://github.com/anza-xyz/pinocchio)** - Lightweight `no_std` Solana framework
- **[Codama](https://github.com/codama-idl)** - IDL-driven client generation
- **[LiteSVM](https://github.com/LiteSVM/litesvm)** - Fast local testing

## Security Audit

`escrow` has been audited by [Accretion](https://accretion.xyz). View the [audit report](audits/2026-accretion-solana-foundation-escrow-audit-A26SFR3.pdf).

Audit status, audited-through commit, and the current unaudited delta are tracked in [audits/AUDIT_STATUS.md](audits/AUDIT_STATUS.md).

---

Built and maintained by the [Solana Foundation](https://solana.org/).

Licensed under MIT. See [LICENSE](LICENSE) for details.

## Support

- [**Solana StackExchange**](https://solana.stackexchange.com/) - tag `escrow-program`
- [**Open an Issue**](https://github.com/solana-foundation/escrow/issues/new)
