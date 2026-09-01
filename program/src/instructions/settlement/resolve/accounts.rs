use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{
        verify_current_program, verify_current_program_account, verify_event_authority, verify_readonly, verify_signer,
        verify_system_program, verify_token_program, verify_writable,
    },
};

/// Accounts for the Resolve instruction (permissionless verdict payout).
///
/// # Account Layout
/// 0. `[signer]` relayer - Fee payer; anyone may submit
/// 1. `[writable]` rent_recipient - Receives rent from closed receipt
/// 2. `[]` escrow - Escrow PDA (signer for vault transfer)
/// 3. `[]` extensions - Settlement extension (read-only)
/// 4. `[writable]` receipt - Deposit receipt (closed on payout)
/// 5. `[writable]` vault - Escrow vault token account (source)
/// 6. `[writable]` depositor_token_account - Depositor ATA (destination if buyer wins)
/// 7. `[writable]` beneficiary_token_account - Beneficiary ATA (destination if seller wins)
/// 8. `[]` dispute_pda - Verdict account (must equal the pinned address + owner)
/// 9. `[]` mint - Token mint
/// 10. `[]` token_program - SPL Token program
/// 11. `[]` system_program - System program
/// 12. `[]` event_authority - Event authority PDA
/// 13. `[]` escrow_program - Current program
pub struct ResolveAccounts<'a> {
    pub relayer: &'a AccountView,
    pub rent_recipient: &'a AccountView,
    pub escrow: &'a AccountView,
    pub extensions: &'a AccountView,
    pub receipt: &'a AccountView,
    pub vault: &'a AccountView,
    pub depositor_token_account: &'a AccountView,
    pub beneficiary_token_account: &'a AccountView,
    pub dispute_pda: &'a AccountView,
    pub mint: &'a AccountView,
    pub token_program: &'a AccountView,
    pub system_program: &'a AccountView,
    pub event_authority: &'a AccountView,
    pub escrow_program: &'a AccountView,
}

impl<'a> TryFrom<&'a [AccountView]> for ResolveAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let [relayer, rent_recipient, escrow, extensions, receipt, vault, depositor_token_account, beneficiary_token_account, dispute_pda, mint, token_program, system_program, event_authority, escrow_program] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        // 1. Validate signers
        verify_signer(relayer, false)?;

        // 2. Validate writable
        verify_writable(rent_recipient, true)?;
        verify_writable(receipt, true)?;
        verify_writable(vault, true)?;
        verify_writable(depositor_token_account, true)?;
        verify_writable(beneficiary_token_account, true)?;

        // 3. Validate readonly
        verify_readonly(escrow)?;
        verify_readonly(extensions)?;
        verify_readonly(dispute_pda)?;
        verify_readonly(mint)?;

        // 4. Validate program IDs
        verify_token_program(token_program)?;
        verify_system_program(system_program)?;
        verify_current_program(escrow_program)?;
        verify_event_authority(event_authority)?;

        // 5. Validate accounts owned by current program
        verify_current_program_account(escrow)?;
        verify_current_program_account(receipt)?;

        Ok(Self {
            relayer,
            rent_recipient,
            escrow,
            extensions,
            receipt,
            vault,
            depositor_token_account,
            beneficiary_token_account,
            dispute_pda,
            mint,
            token_program,
            system_program,
            event_authority,
            escrow_program,
        })
    }
}

impl<'a> InstructionAccounts<'a> for ResolveAccounts<'a> {}
