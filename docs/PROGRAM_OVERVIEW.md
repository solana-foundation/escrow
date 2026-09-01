# Escrow Program - Technical Reference

## Instructions

| #   | Instruction         | Discriminator | Description                                     |
| --- | ------------------- | ------------- | ----------------------------------------------- |
| 0   | CreatesEscrow       | `0`           | Create a new escrow with admin                  |
| 1   | AddTimelock         | `1`           | Add/update timelock extension                   |
| 2   | SetHook             | `2`           | Set hook program for deposit/withdraw callbacks |
| 3   | Deposit             | `3`           | Deposit tokens, receive receipt                 |
| 4   | UpdateAdmin         | `4`           | Transfer admin to new address                   |
| 5   | Withdraw            | `5`           | Withdraw tokens using receipt                   |
| 6   | AllowMint           | `6`           | Allow a mint for deposits                       |
| 7   | BlockMint           | `7`           | Block a previously allowed mint                 |
| 8   | BlockTokenExtension | `8`           | Block Token-2022 extension types                |
| 13  | SetSettlement       | `13`          | Configure two-party settlement (beneficiary + dispute program) |
| 14  | Approve             | `14`          | Async cooperative approval; releases on 2nd approval           |
| 15  | RaiseDispute        | `15`          | Lock escrow; only a verdict may move funds                     |
| 16  | Resolve             | `16`          | Read dispute verdict; pay winner, close receipt                |
| 228 | EmitEvent           | `228`         | Internal CPI for event emission                 |

---

## Instruction Details

### CreatesEscrow

Creates a new escrow account with the specified admin.

**Accounts:**

| #   | Name            | Signer | Writable | Description                    |
| --- | --------------- | ------ | -------- | ------------------------------ |
| 0   | payer           | Yes    | Yes      | Pays for account creation      |
| 1   | admin           | Yes    | No       | Admin of the escrow            |
| 2   | escrow_seed     | Yes    | No       | Seed signer for PDA derivation |
| 3   | escrow          | No     | Yes      | Escrow PDA to create           |
| 4   | system_program  | No     | No       | System program                 |
| 5   | event_authority | No     | No       | Event authority PDA            |
| 6   | escrow_program  | No     | No       | This program                   |

**Data:**

| Field | Type | Description   |
| ----- | ---- | ------------- |
| bump  | u8   | PDA bump seed |

**Events:** `CreateEscrowEvent`

---

### AllowMint

Allows a mint for deposits and creates the vault ATA.

**Accounts:**

| #   | Name                     | Signer | Writable | Description                   |
| --- | ------------------------ | ------ | -------- | ----------------------------- |
| 0   | payer                    | Yes    | Yes      | Pays for account creation     |
| 1   | admin                    | Yes    | No       | Must match escrow.admin       |
| 2   | escrow                   | No     | No       | Escrow PDA                    |
| 3   | escrow_extensions        | No     | No       | Extensions PDA (may be empty) |
| 4   | mint                     | No     | No       | Mint to allow                 |
| 5   | allowed_mint             | No     | Yes      | AllowedMint PDA to create     |
| 6   | vault                    | No     | Yes      | Vault ATA to create           |
| 7   | token_program            | No     | No       | Token program                 |
| 8   | associated_token_program | No     | No       | ATA program                   |
| 9   | system_program           | No     | No       | System program                |
| 10  | event_authority          | No     | No       | Event authority PDA           |
| 11  | escrow_program           | No     | No       | This program                  |

**Data:**

| Field | Type | Description          |
| ----- | ---- | -------------------- |
| bump  | u8   | AllowedMint PDA bump |

**Events:** `AllowMintEvent`

---

### BlockMint

Blocks a previously allowed mint by closing the AllowedMint account.

**Accounts:**

| #   | Name            | Signer | Writable | Description              |
| --- | --------------- | ------ | -------- | ------------------------ |
| 0   | admin           | Yes    | No       | Must match escrow.admin  |
| 1   | payer           | Yes    | No       | Transaction fee payer    |
| 2   | rent_recipient  | No     | Yes      | Receives rent refund     |
| 3   | escrow          | No     | No       | Escrow PDA               |
| 4   | mint            | No     | No       | Mint being blocked       |
| 5   | allowed_mint    | No     | Yes      | AllowedMint PDA to close |
| 6   | token_program   | No     | No       | Token program            |
| 7   | event_authority | No     | No       | Event authority PDA      |
| 8   | escrow_program  | No     | No       | This program             |

**Data:** None

**Events:** `BlockMintEvent`

---

### Deposit

Deposits tokens into the escrow and creates a receipt.

**Accounts:**

| #   | Name                    | Signer | Writable | Description                      |
| --- | ----------------------- | ------ | -------- | -------------------------------- |
| 0   | payer                   | Yes    | Yes      | Pays for receipt creation        |
| 1   | depositor               | Yes    | No       | Token authority                  |
| 2   | escrow                  | No     | No       | Escrow PDA                       |
| 3   | allowed_mint            | No     | No       | AllowedMint PDA (validates mint) |
| 4   | receipt_seed            | Yes    | No       | Seed for receipt uniqueness      |
| 5   | receipt                 | No     | Yes      | Receipt PDA to create            |
| 6   | vault                   | No     | Yes      | Escrow's vault (destination)     |
| 7   | depositor_token_account | No     | Yes      | Depositor's tokens (source)      |
| 8   | mint                    | No     | No       | Token mint                       |
| 9   | token_program           | No     | No       | Token program                    |
| 10  | system_program          | No     | No       | System program                   |
| 11  | event_authority         | No     | No       | Event authority PDA              |
| 12  | escrow_program          | No     | No       | This program                     |
| 13  | extensions              | No     | No       | Extensions PDA                   |
| ... | remaining               | Varies | No       | Hook program + extra accounts    |

**Data:**

| Field  | Type | Description       |
| ------ | ---- | ----------------- |
| amount | u64  | Amount to deposit |
| bump   | u8   | Receipt PDA bump  |

**Events:** `DepositEvent`

---

### Withdraw

Withdraws tokens using a receipt. Receipt is closed after withdrawal.

**Accounts:**

| #   | Name                     | Signer | Writable | Description                       |
| --- | ------------------------ | ------ | -------- | --------------------------------- |
| 0   | payer                    | Yes    | No       | Transaction fee payer             |
| 1   | rent_recipient           | No     | Yes      | Receives rent from closed receipt |
| 2   | withdrawer               | Yes    | No       | Must match receipt.depositor      |
| 3   | escrow                   | No     | No       | Escrow PDA (signer for vault)     |
| 4   | extensions               | No     | No       | Extensions PDA                    |
| 5   | receipt                  | No     | Yes      | Receipt to verify and close       |
| 6   | vault                    | No     | Yes      | Escrow's vault (source)           |
| 7   | withdrawer_token_account | No     | Yes      | Withdrawer's tokens (destination) |
| 8   | mint                     | No     | No       | Token mint                        |
| 9   | token_program            | No     | No       | Token program                     |
| 10  | system_program           | No     | No       | System program                    |
| 11  | event_authority          | No     | No       | Event authority PDA               |
| 12  | escrow_program           | No     | No       | This program                      |
| ... | remaining                | Varies | No       | Hook program + extra accounts     |

**Data:** None

**Events:** `WithdrawEvent`

---

### UpdateAdmin

Transfers escrow admin to a new address.

**Accounts:**

| #   | Name            | Signer | Writable | Description         |
| --- | --------------- | ------ | -------- | ------------------- |
| 0   | admin           | Yes    | No       | Current admin       |
| 1   | new_admin       | Yes    | No       | New admin           |
| 2   | escrow          | No     | Yes      | Escrow to update    |
| 3   | event_authority | No     | No       | Event authority PDA |
| 4   | escrow_program  | No     | No       | This program        |

**Data:** None

**Events:** `AdminUpdateEvent`

---

### AddTimelock

Adds or updates the timelock extension.

**Accounts:**

| #   | Name            | Signer | Writable | Description               |
| --- | --------------- | ------ | -------- | ------------------------- |
| 0   | payer           | Yes    | Yes      | Pays for account creation |
| 1   | admin           | Yes    | No       | Must match escrow.admin   |
| 2   | escrow          | No     | No       | Escrow PDA                |
| 3   | extensions      | No     | Yes      | Extensions PDA            |
| 4   | system_program  | No     | No       | System program            |
| 5   | event_authority | No     | No       | Event authority PDA       |
| 6   | escrow_program  | No     | No       | This program              |

**Data:**

| Field         | Type | Description              |
| ------------- | ---- | ------------------------ |
| lock_duration | u64  | Lock duration in seconds |
| bump          | u8   | Extensions PDA bump      |

**Events:** `TimelockAddedEvent`

---

### SetHook

Sets the hook program for deposit/withdraw callbacks.

**Warning:**

If an escrow is made immutable after setting a hook, the hook configuration is permanent and cannot be changed or removed.

**Accounts:**

| #   | Name            | Signer | Writable | Description               |
| --- | --------------- | ------ | -------- | ------------------------- |
| 0   | payer           | Yes    | Yes      | Pays for account creation |
| 1   | admin           | Yes    | No       | Must match escrow.admin   |
| 2   | escrow          | No     | No       | Escrow PDA                |
| 3   | extensions      | No     | Yes      | Extensions PDA            |
| 4   | system_program  | No     | No       | System program            |
| 5   | event_authority | No     | No       | Event authority PDA       |
| 6   | escrow_program  | No     | No       | This program              |

**Data:**

| Field        | Type   | Description          |
| ------------ | ------ | -------------------- |
| hook_program | Pubkey | Hook program address |
| bump         | u8     | Extensions PDA bump  |

**Events:** `HookSetEvent`

---

### BlockTokenExtension

Blocks a Token-2022 extension type for the escrow.

**Accounts:**

| #   | Name            | Signer | Writable | Description               |
| --- | --------------- | ------ | -------- | ------------------------- |
| 0   | payer           | Yes    | Yes      | Pays for account creation |
| 1   | admin           | Yes    | No       | Must match escrow.admin   |
| 2   | escrow          | No     | No       | Escrow PDA                |
| 3   | extensions      | No     | Yes      | Extensions PDA            |
| 4   | system_program  | No     | No       | System program            |
| 5   | event_authority | No     | No       | Event authority PDA       |
| 6   | escrow_program  | No     | No       | This program              |

**Data:**

| Field          | Type | Description                        |
| -------------- | ---- | ---------------------------------- |
| extension_type | u16  | Token-2022 extension type to block |
| bump           | u8   | Extensions PDA bump                |

**Events:** `TokenExtensionBlockedEvent`

---

## Account Types

### Escrow

Main escrow configuration account.

**PDA Seeds:** `["escrow", escrow_seed]`

**Layout:**

| Offset | Size | Field         | Type   |
| ------ | ---- | ------------- | ------ |
| 0      | 1    | discriminator | u8     |
| 1      | 1    | version       | u8     |
| 2      | 1    | bump          | u8     |
| 3      | 32   | escrow_seed   | Pubkey |
| 35     | 32   | admin         | Pubkey |

**Total:** 67 bytes

---

### Receipt

Deposit receipt tracking amount and timestamp.

**PDA Seeds:** `["receipt", escrow, depositor, mint, receipt_seed]`

**Layout:**

| Offset | Size | Field         | Type    |
| ------ | ---- | ------------- | ------- |
| 0      | 1    | discriminator | u8      |
| 1      | 1    | version       | u8      |
| 2      | 1    | bump          | u8      |
| 3      | 7    | \_padding     | [u8; 7] |
| 10     | 32   | escrow        | Pubkey  |
| 42     | 32   | depositor     | Pubkey  |
| 74     | 32   | mint          | Pubkey  |
| 106    | 32   | receipt_seed  | Pubkey  |
| 138    | 8    | amount        | u64     |
| 146    | 8    | deposited_at  | i64     |

**Total:** 154 bytes

---

### AllowedMint

Marker account indicating a mint is allowed.

**PDA Seeds:** `["allowed_mint", escrow, mint]`

**Layout:**

| Offset | Size | Field         | Type |
| ------ | ---- | ------------- | ---- |
| 0      | 1    | discriminator | u8   |
| 1      | 1    | version       | u8   |
| 2      | 1    | bump          | u8   |

**Total:** 3 bytes

---

### EscrowExtensions

TLV-encoded extension data.

**PDA Seeds:** `["extensions", escrow]`

**Header Layout:**

| Offset | Size | Field           | Type |
| ------ | ---- | --------------- | ---- |
| 0      | 1    | discriminator   | u8   |
| 1      | 1    | version         | u8   |
| 2      | 1    | bump            | u8   |
| 3      | 1    | extension_count | u8   |

**TLV Format (after header):**

Each extension:

| Size | Field        |
| ---- | ------------ |
| 2    | type (u16)   |
| 2    | length (u16) |
| n    | data         |

---

## Extensions

### Timelock (type = 0)

**Data:**

| Size | Field         | Type |
| ---- | ------------- | ---- |
| 8    | lock_duration | u64  |

Withdrawals blocked until `deposited_at + lock_duration`.

---

### Hook (type = 1)

**Data:**

| Size | Field        | Type   |
| ---- | ------------ | ------ |
| 32   | hook_program | Pubkey |

**Hook Points:**

- `0` - PreDeposit
- `1` - PostDeposit
- `2` - PreWithdraw
- `3` - PostWithdraw

Hook receives 1-byte instruction data (hook point) and accounts: escrow, actor, mint, receipt, vault, plus any remaining accounts.

**Warning:**

- Hook execution is fail-closed. Any revert aborts the parent escrow instruction.
- All four hook points are enforced when a hook is configured.
- For immutable escrows, hook behavior is permanently embedded.

---

### BlockedTokenExtensions (type = 2)

**Data:**

| Size | Field      | Type         |
| ---- | ---------- | ------------ |
| 1    | count      | u8           |
| 2×n  | extensions | [u16; count] |

During `AllowMint`, the program checks if the mint has any blocked Token-2022 extensions.

**Always Blocked (hardcoded):**

- PermanentDelegate
- NonTransferable
- Pausable

---

### Settlement (type = 4)

Two-party settlement: a `beneficiary` (seller) who can be paid cooperatively or via a dispute-program verdict.

**Data (102 bytes):**

| Offset | Size | Field           | Type   |
| ------ | ---- | --------------- | ------ |
| 0      | 32   | beneficiary     | Pubkey |
| 32     | 32   | dispute_program | Pubkey |
| 64     | 1    | release_value   | u8     |
| 65     | 1    | buyer_approved  | bool   |
| 66     | 1    | seller_approved | bool   |
| 67     | 1    | disputed        | bool   |
| 68     | 32   | dispute_pda     | Pubkey |
| 100    | 2    | offset          | u16    |

**Resolution modes:**
- **Cooperative** (`Approve`): depositor + beneficiary each sign off; the second approval releases funds to the beneficiary.
- **Disputed** (`RaiseDispute` → `Resolve`): either party locks the escrow; only a verdict byte read from `dispute_pda` (owned by `dispute_program`) may move funds.

**Verdict tri-state** (byte at `dispute_pda.data[offset]`): `== release_value` → pay seller · `== 255` → `DisputePending` · else → refund buyer.

**Notes:** `release_value` must be `!= 255`. `dispute_pda`+`offset` are supplied by the disputer at `RaiseDispute`; the escrow checks `dispute_pda.owner() == dispute_program` (no CPI). Binding the verdict PDA to this escrow is the dispute program's responsibility. Once `disputed`, `Withdraw` is blocked. See `docs/DISPUTS.md` for the full design.


## Error Codes

| Code | Name                         | Description                                  |
| ---- | ---------------------------- | -------------------------------------------- |
| 0    | InvalidEscrowId              | Escrow ID invalid or does not respect rules  |
| 1    | InvalidAdmin                 | Admin invalid or does not match escrow admin |
| 2    | InvalidEventAuthority        | Event authority PDA is invalid               |
| 3    | TimelockNotExpired           | Timelock has not expired yet                 |
| 4    | HookRejected                 | External hook rejected the operation         |
| 5    | InvalidWithdrawer            | Withdrawer does not match receipt depositor  |
| 6    | InvalidReceiptEscrow         | Receipt escrow does not match escrow         |
| 7    | HookProgramMismatch          | Hook program mismatch                        |
| 8    | MintNotAllowed               | Mint is not allowed for this escrow          |
| 9    | PermanentDelegateNotAllowed  | Mint has PermanentDelegate extension         |
| 10   | NonTransferableNotAllowed    | Mint has NonTransferable extension           |
| 11   | PausableNotAllowed           | Mint has Pausable extension                  |
| 12   | TokenExtensionAlreadyBlocked | Token extension already blocked              |
| 13   | ZeroDepositAmount            | Zero deposit amount                          |
| 14   | InvalidArbiter               | Arbiter signer is missing or does not match  |
| 15   | TokenExtensionNotBlocked     | Token extension is not currently blocked     |
| 16   | EscrowImmutable              | Escrow is immutable and cannot be modified   |
| 17   | EscrowDisputed               | Escrow is disputed; only a verdict may move  |
| 18   | DisputePending               | Dispute verdict is still pending             |
| 19   | AlreadyDisputed              | A dispute has already been raised            |
| 20   | NotDisputed                  | No dispute has been raised                   |
| 21   | InvalidDisputePda            | Dispute PDA owner does not match             |
| 22   | VerdictOutOfBounds           | Verdict offset out of bounds                 |
| 23   | SettlementNotConfigured      | No settlement configured for this escrow     |
| 24   | InvalidApprover              | Approver is neither depositor nor beneficiary|
| 25   | InvalidReleaseValue          | release_value must not equal 255             |

---

## Security Considerations

1. **Token-2022 blocking** - PermanentDelegate, NonTransferable, and Pausable are always blocked to prevent token manipulation
2. **Hook validation and liveness dependency** - Hook programs must be passed correctly; mismatches cause HookProgramMismatch, and hook reverts abort escrow operations (`HookRejected`)
3. **Receipt ownership** - Only the original depositor can withdraw using their receipt
4. **Timelock enforcement** - Clock sysvar used to verify lock duration has passed
5. **PDA validation** - All PDAs validated against expected seeds and bumps
