use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{
        verify_current_program, verify_current_program_account, verify_event_authority, verify_readonly, verify_signer,
        verify_system_program, verify_token_program, verify_writable,
    },
};

/// Accounts for the Approve instruction (async cooperative approval).
///
/// # Account Layout
/// 0. `[signer]` approver - Depositor (buyer) or beneficiary (seller)
/// 1. `[writable]` rent_recipient - Receives rent from closed receipt on release
/// 2. `[]` escrow - Escrow PDA (signer for vault transfer)
/// 3. `[writable]` extensions - Settlement extension lives here
/// 4. `[writable]` receipt - Deposit receipt (closed on release)
/// 5. `[writable]` vault - Escrow vault token account (source on release)
/// 6. `[writable]` beneficiary_token_account - Beneficiary ATA (destination on release)
/// 7. `[]` mint - Token mint
/// 8. `[]` token_program - SPL Token program
/// 9. `[]` system_program - System program
/// 10. `[]` event_authority - Event authority PDA
/// 11. `[]` escrow_program - Current program
pub struct ApproveAccounts<'a> {
    pub approver: &'a AccountView,
    pub rent_recipient: &'a AccountView,
    pub escrow: &'a AccountView,
    pub extensions: &'a AccountView,
    pub receipt: &'a AccountView,
    pub vault: &'a AccountView,
    pub beneficiary_token_account: &'a AccountView,
    pub mint: &'a AccountView,
    pub token_program: &'a AccountView,
    pub system_program: &'a AccountView,
    pub event_authority: &'a AccountView,
    pub escrow_program: &'a AccountView,
}

impl<'a> TryFrom<&'a [AccountView]> for ApproveAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let [approver, rent_recipient, escrow, extensions, receipt, vault, beneficiary_token_account, mint, token_program, system_program, event_authority, escrow_program] =
            accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        // 1. Validate signers
        verify_signer(approver, false)?;

        // 2. Validate writable
        verify_writable(rent_recipient, true)?;
        verify_writable(extensions, true)?;
        verify_writable(receipt, true)?;
        verify_writable(vault, true)?;
        verify_writable(beneficiary_token_account, true)?;

        // 3. Validate readonly
        verify_readonly(escrow)?;
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
            approver,
            rent_recipient,
            escrow,
            extensions,
            receipt,
            vault,
            beneficiary_token_account,
            mint,
            token_program,
            system_program,
            event_authority,
            escrow_program,
        })
    }
}

impl<'a> InstructionAccounts<'a> for ApproveAccounts<'a> {}
