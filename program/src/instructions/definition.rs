use codama::CodamaInstructions;
use pinocchio::Address;

/// Instructions for the Escrow Program.
#[allow(clippy::large_enum_variant)]
#[repr(C, u8)]
#[derive(Clone, Debug, PartialEq, CodamaInstructions)]
pub enum EscrowProgramInstruction {
    /// Create a new escrow with the specified admin.
    #[codama(account(name = "payer", docs = "Pays for escrow account creation", signer, writable))]
    #[codama(account(name = "admin", docs = "Admin authority for the escrow", signer))]
    #[codama(account(name = "escrow_seed", docs = "Random keypair seed for escrow PDA derivation", signer))]
    #[codama(account(
        name = "escrow",
        docs = "Escrow PDA account to be created",
        writable,
        default_value = pda("escrow", [seed("escrowSeed", account("escrowSeed"))])
    ))]
    #[codama(account(name = "system_program", docs = "System program", default_value = program("system")))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    CreatesEscrow {
        /// Bump for the escrow PDA
        #[codama(default_value = account_bump("escrow"))]
        bump: u8,
    } = 0,

    /// Add timelock extension to an escrow.
    #[codama(account(name = "payer", docs = "Pays for extensions account creation", signer, writable))]
    #[codama(account(name = "admin", docs = "Admin authority for the escrow", signer))]
    #[codama(account(name = "escrow", docs = "Escrow account to add timelock to",))]
    #[codama(account(
        name = "extensions",
        docs = "Extensions PDA account to store timelock config",
        writable,
        default_value = pda("extensions", [seed("escrow", account("escrow"))])
    ))]
    #[codama(account(name = "system_program", docs = "System program", default_value = program("system")))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    AddTimelock {
        /// Bump for extensions PDA
        #[codama(default_value = account_bump("extensions"))]
        extensions_bump: u8,
        /// Lock duration in seconds from deposit
        lock_duration: u64,
    } = 1,

    /// Set hook program on an escrow.
    #[codama(account(name = "payer", docs = "Pays for extensions account creation", signer, writable))]
    #[codama(account(name = "admin", docs = "Admin authority for the escrow", signer))]
    #[codama(account(name = "escrow", docs = "Escrow account to set hook on"))]
    #[codama(account(
        name = "extensions",
        docs = "Extensions PDA account to store hook config",
        writable,
        default_value = pda("extensions", [seed("escrow", account("escrow"))])
    ))]
    #[codama(account(name = "system_program", docs = "System program", default_value = program("system")))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    SetHook {
        /// Bump for extensions PDA
        #[codama(default_value = account_bump("extensions"))]
        extensions_bump: u8,
        /// Hook program address
        hook_program: Address,
    } = 2,

    /// Deposit tokens into an escrow vault and create a receipt.
    #[codama(account(name = "payer", docs = "Pays for receipt account creation", signer, writable))]
    #[codama(account(name = "depositor", docs = "Authority depositing tokens", signer))]
    #[codama(account(name = "escrow", docs = "Escrow account to deposit into"))]
    #[codama(account(
        name = "allowed_mint",
        docs = "Allowed mint PDA proving this mint is permitted",
        default_value = pda("allowedMint", [seed("escrow", account("escrow")), seed("mint", account("mint"))])
    ))]
    #[codama(account(name = "receipt_seed", docs = "Random keypair seed for receipt PDA derivation", signer))]
    #[codama(account(
        name = "receipt",
        docs = "Deposit receipt PDA to be created",
        writable,
        default_value = pda("receipt", [
            seed("escrow", account("escrow")),
            seed("depositor", account("depositor")),
            seed("mint", account("mint")),
            seed("receiptSeed", account("receiptSeed"))
        ])
    ))]
    #[codama(account(
        name = "vault",
        docs = "Escrow vault token account to receive tokens",
        writable,
        default_value = pda("associatedToken", program = "associatedToken", [seed("owner", account("escrow")), seed("tokenProgram", account("tokenProgram")), seed("mint", account("mint"))])
    ))]
    #[codama(account(
        name = "depositor_token_account",
        docs = "Depositor's token account to transfer from",
        writable,
        default_value = pda("associatedToken", program = "associatedToken", [seed("owner", account("depositor")), seed("tokenProgram", account("tokenProgram")), seed("mint", account("mint"))])
    ))]
    #[codama(account(name = "mint", docs = "Token mint of the deposited tokens"))]
    #[codama(account(name = "token_program", docs = "SPL Token program", default_value = program("token")))]
    #[codama(account(name = "system_program", docs = "System program", default_value = program("system")))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    #[codama(account(
        name = "extensions",
        docs = "Extensions PDA for escrow configuration",
        default_value = pda("extensions", [seed("escrow", account("escrow"))])
    ))]
    Deposit {
        /// Bump for the deposit receipt PDA
        #[codama(default_value = account_bump("receipt"))]
        bump: u8,
        /// Amount of tokens to deposit
        amount: u64,
    } = 3,

    /// Update the admin on an escrow.
    #[codama(account(name = "admin", docs = "Current admin authority for the escrow", signer))]
    #[codama(account(name = "new_admin", docs = "New admin authority to transfer ownership to", signer))]
    #[codama(account(name = "escrow", docs = "Escrow account to update admin on", writable))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    UpdateAdmin {} = 4,

    /// Withdraw tokens from an escrow vault back to the original depositor.
    #[codama(account(name = "rent_recipient", docs = "Receives rent from closed receipt account", writable))]
    #[codama(account(name = "withdrawer", docs = "Authority withdrawing tokens", signer))]
    #[codama(account(name = "escrow", docs = "Escrow account to withdraw from"))]
    #[codama(account(
        name = "extensions",
        docs = "Extensions PDA for escrow configuration",
        default_value = pda("extensions", [seed("escrow", account("escrow"))])
    ))]
    #[codama(account(name = "receipt", docs = "Deposit receipt to close upon withdrawal", writable))]
    #[codama(account(
        name = "vault",
        docs = "Escrow vault token account to transfer from",
        writable,
        default_value = pda("associatedToken", program = "associatedToken", [seed("owner", account("escrow")), seed("tokenProgram", account("tokenProgram")), seed("mint", account("mint"))])
    ))]
    #[codama(account(
        name = "withdrawer_token_account",
        docs = "Withdrawer's token account to receive tokens",
        writable,
        default_value = pda("associatedToken", program = "associatedToken", [seed("owner", account("withdrawer")), seed("tokenProgram", account("tokenProgram")), seed("mint", account("mint"))])
    ))]
    #[codama(account(name = "mint", docs = "Token mint of the withdrawn tokens"))]
    #[codama(account(name = "token_program", docs = "SPL Token program", default_value = program("token")))]
    #[codama(account(name = "system_program", docs = "System program", default_value = program("system")))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    Withdraw {} = 5,

    /// Allow a token mint for deposits into an escrow.
    /// Also creates the vault ATA for the escrow to hold tokens of this mint.
    #[codama(account(name = "payer", docs = "Pays for allowed mint and vault account creation", signer, writable))]
    #[codama(account(name = "admin", docs = "Admin authority for the escrow", signer))]
    #[codama(account(name = "escrow", docs = "Escrow account to allow mint on"))]
    #[codama(account(
        name = "escrow_extensions",
        docs = "Extensions PDA for escrow configuration",
        default_value = pda("extensions", [seed("escrow", account("escrow"))])
    ))]
    #[codama(account(name = "mint", docs = "Token mint to allow for deposits"))]
    #[codama(account(
        name = "allowed_mint",
        docs = "Allowed mint PDA to be created",
        writable,
        default_value = pda("allowedMint", [seed("escrow", account("escrow")), seed("mint", account("mint"))])
    ))]
    #[codama(account(
        name = "vault",
        docs = "Escrow vault ATA to be created for this mint",
        writable,
        default_value = pda("associatedToken", program = "associatedToken", [seed("owner", account("escrow")), seed("tokenProgram", account("tokenProgram")), seed("mint", account("mint"))])
    ))]
    #[codama(account(name = "token_program", docs = "SPL Token program", default_value = program("token")))]
    #[codama(account(
        name = "associated_token_program",
        docs = "Associated Token program for vault creation",
        default_value = program("associated-token")
    ))]
    #[codama(account(name = "system_program", docs = "System program", default_value = program("system")))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    AllowMint {
        /// Bump for the allowed_mint PDA
        #[codama(default_value = account_bump("allowedMint"))]
        bump: u8,
    } = 6,

    /// Block a token mint from deposits into an escrow.
    #[codama(account(name = "admin", docs = "Admin authority for the escrow", signer))]
    #[codama(account(name = "rent_recipient", docs = "Receives rent from closed allowed mint account", writable))]
    #[codama(account(name = "escrow", docs = "Escrow account to block mint on"))]
    #[codama(account(name = "mint", docs = "Token mint to block from deposits"))]
    #[codama(account(
        name = "allowed_mint",
        docs = "Allowed mint PDA to be closed",
        writable,
        default_value = pda("allowedMint", [seed("escrow", account("escrow")), seed("mint", account("mint"))])
    ))]
    #[codama(account(name = "token_program", docs = "SPL Token program", default_value = program("token")))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    BlockMint {} = 7,

    /// Block a token extension for an escrow.
    #[codama(account(name = "payer", docs = "Pays for extensions account creation", signer, writable))]
    #[codama(account(name = "admin", docs = "Admin authority for the escrow", signer))]
    #[codama(account(name = "escrow", docs = "Escrow account to block extension on"))]
    #[codama(account(
        name = "extensions",
        docs = "Extensions PDA account to store blocked extensions",
        writable,
        default_value = pda("extensions", [seed("escrow", account("escrow"))])
    ))]
    #[codama(account(name = "system_program", docs = "System program", default_value = program("system")))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    BlockTokenExtension {
        /// Bump for extensions PDA
        #[codama(default_value = account_bump("extensions"))]
        extensions_bump: u8,
        /// Token-2022 ExtensionType value to block
        blocked_extension: u16,
    } = 8,

    /// Set an arbiter on an escrow. The arbiter must sign withdrawal transactions.
    #[codama(account(name = "payer", signer, writable))]
    #[codama(account(name = "admin", signer))]
    #[codama(account(name = "arbiter", signer))]
    #[codama(account(name = "escrow"))]
    #[codama(account(
        name = "extensions",
        writable,
        default_value = pda("extensions", [seed("escrow", account("escrow"))])
    ))]
    #[codama(account(name = "system_program", default_value = program("system")))]
    #[codama(account(
        name = "event_authority",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    SetArbiter {
        /// Bump for extensions PDA
        #[codama(default_value = account_bump("extensions"))]
        extensions_bump: u8,
    } = 9,

    /// Remove an extension from an escrow.
    #[codama(account(name = "payer", docs = "Pays for transaction fees", signer, writable))]
    #[codama(account(name = "admin", docs = "Admin authority for the escrow", signer))]
    #[codama(account(name = "escrow", docs = "Escrow account to remove extension from"))]
    #[codama(account(
        name = "extensions",
        docs = "Extensions PDA account to mutate",
        writable,
        default_value = pda("extensions", [seed("escrow", account("escrow"))])
    ))]
    #[codama(account(name = "system_program", docs = "System program", default_value = program("system")))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    RemoveExtension {
        /// Bump for extensions PDA
        #[codama(default_value = account_bump("extensions"))]
        extensions_bump: u8,
        /// Escrow extension type discriminator to remove
        extension_type: u16,
    } = 10,

    /// Unblock a previously blocked token extension for an escrow.
    #[codama(account(name = "payer", docs = "Pays for transaction fees", signer, writable))]
    #[codama(account(name = "admin", docs = "Admin authority for the escrow", signer))]
    #[codama(account(name = "escrow", docs = "Escrow account to unblock extension on"))]
    #[codama(account(
        name = "extensions",
        docs = "Extensions PDA account to mutate",
        writable,
        default_value = pda("extensions", [seed("escrow", account("escrow"))])
    ))]
    #[codama(account(name = "system_program", docs = "System program", default_value = program("system")))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    UnblockTokenExtension {
        /// Bump for extensions PDA
        #[codama(default_value = account_bump("extensions"))]
        extensions_bump: u8,
        /// Token-2022 ExtensionType value to unblock
        blocked_extension: u16,
    } = 11,

    /// Lock an escrow so configuration can no longer be modified.
    #[codama(account(name = "admin", docs = "Admin authority for the escrow", signer))]
    #[codama(account(name = "escrow", docs = "Escrow account to lock as immutable", writable))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    SetImmutable {} = 12,

    /// Configure two-party settlement (beneficiary + dispute program) on an escrow.
    #[codama(account(name = "payer", docs = "Pays for extensions account creation", signer, writable))]
    #[codama(account(name = "admin", docs = "Admin authority for the escrow", signer))]
    #[codama(account(name = "escrow", docs = "Escrow account to configure settlement on"))]
    #[codama(account(
        name = "extensions",
        docs = "Extensions PDA account to store settlement config",
        writable,
        default_value = pda("extensions", [seed("escrow", account("escrow"))])
    ))]
    #[codama(account(name = "system_program", docs = "System program", default_value = program("system")))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    SetSettlement {
        /// Bump for extensions PDA
        #[codama(default_value = account_bump("extensions"))]
        extensions_bump: u8,
        /// Seller / payout target
        beneficiary: Address,
        /// Trusted owner of any verdict PDA
        dispute_program: Address,
        /// Verdict byte meaning "pay seller" (must be != 255)
        release_value: u8,
    } = 13,

    /// Async cooperative approval; releases funds to the beneficiary on the second approval.
    #[codama(account(name = "approver", docs = "Depositor (buyer) or beneficiary (seller)", signer))]
    #[codama(account(name = "rent_recipient", docs = "Receives rent from closed receipt on release", writable))]
    #[codama(account(name = "escrow", docs = "Escrow PDA (signer for vault transfer)"))]
    #[codama(account(
        name = "extensions",
        docs = "Extensions PDA holding settlement config",
        writable,
        default_value = pda("extensions", [seed("escrow", account("escrow"))])
    ))]
    #[codama(account(name = "receipt", docs = "Deposit receipt (closed on release)", writable))]
    #[codama(account(
        name = "vault",
        docs = "Escrow vault token account (source on release)",
        writable,
        default_value = pda("associatedToken", program = "associatedToken", [seed("owner", account("escrow")), seed("tokenProgram", account("tokenProgram")), seed("mint", account("mint"))])
    ))]
    #[codama(account(name = "beneficiary_token_account", docs = "Beneficiary ATA (destination on release)", writable))]
    #[codama(account(name = "mint", docs = "Token mint"))]
    #[codama(account(name = "token_program", docs = "SPL Token program", default_value = program("token")))]
    #[codama(account(name = "system_program", docs = "System program", default_value = program("system")))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    Approve {} = 14,

    /// Lock the escrow into dispute mode; only a verdict may move funds afterwards.
    #[codama(account(name = "disputer", docs = "Depositor (buyer) or beneficiary (seller)", signer))]
    #[codama(account(name = "escrow", docs = "Escrow PDA"))]
    #[codama(account(
        name = "extensions",
        docs = "Extensions PDA to store the verdict pin and disputed flag",
        writable,
        default_value = pda("extensions", [seed("escrow", account("escrow"))])
    ))]
    #[codama(account(name = "receipt", docs = "Deposit receipt identifying the depositor"))]
    #[codama(account(name = "dispute_pda", docs = "Verdict account supplied by the disputer; must be owned by the configured dispute program"))]
    #[codama(account(name = "system_program", docs = "System program", default_value = program("system")))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    RaiseDispute {
        /// Byte offset of the verdict within the dispute PDA
        offset: u16,
    } = 15,

    /// Permissionless: read the dispute verdict and pay out to the winner, then close the receipt.
    #[codama(account(name = "relayer", docs = "Fee payer; anyone may submit", signer))]
    #[codama(account(name = "rent_recipient", docs = "Receives rent from closed receipt", writable))]
    #[codama(account(name = "escrow", docs = "Escrow PDA (signer for vault transfer)"))]
    #[codama(account(
        name = "extensions",
        docs = "Extensions PDA holding settlement config",
        default_value = pda("extensions", [seed("escrow", account("escrow"))])
    ))]
    #[codama(account(name = "receipt", docs = "Deposit receipt (closed on payout)", writable))]
    #[codama(account(
        name = "vault",
        docs = "Escrow vault token account (source)",
        writable,
        default_value = pda("associatedToken", program = "associatedToken", [seed("owner", account("escrow")), seed("tokenProgram", account("tokenProgram")), seed("mint", account("mint"))])
    ))]
    #[codama(account(name = "depositor_token_account", docs = "Depositor ATA (destination if buyer wins)", writable))]
    #[codama(account(name = "beneficiary_token_account", docs = "Beneficiary ATA (destination if seller wins)", writable))]
    #[codama(account(name = "dispute_pda", docs = "Verdict account; must equal the pinned address and owner"))]
    #[codama(account(name = "mint", docs = "Token mint"))]
    #[codama(account(name = "token_program", docs = "SPL Token program", default_value = program("token")))]
    #[codama(account(name = "system_program", docs = "System program", default_value = program("system")))]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA for CPI event emission",
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    #[codama(account(
        name = "escrow_program",
        docs = "Escrow program for CPI event emission",
        default_value = public_key("Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg")
    ))]
    Resolve {} = 16,

    /// Invoked via CPI to emit event data in instruction args (prevents log truncation).
    #[codama(skip)]
    #[codama(account(
        name = "event_authority",
        docs = "Event authority PDA that must sign via CPI",
        signer,
        default_value = public_key("Eq63FWYo9DXgwoTnpK9gjp7BH4PyhSPo11zEF9FK7f4M")
    ))]
    EmitEvent {} = 228,
}
