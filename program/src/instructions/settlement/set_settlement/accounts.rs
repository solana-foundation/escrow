use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{
        verify_current_program, verify_current_program_account, verify_event_authority, verify_readonly, verify_signer,
        verify_system_program, verify_writable,
    },
};

/// Accounts for the SetSettlement instruction
///
/// # Account Layout
/// 0. `[signer, writable]` payer - Pays for account creation
/// 1. `[signer]` admin - Must match escrow.admin
/// 2. `[]` escrow - Escrow account to configure settlement on
/// 3. `[writable]` extensions - Extensions PDA (created if doesn't exist)
/// 4. `[]` system_program - System program for account creation
/// 5. `[]` event_authority - Event authority PDA
/// 6. `[]` escrow_program - Current program
pub struct SetSettlementAccounts<'a> {
    pub payer: &'a AccountView,
    pub admin: &'a AccountView,
    pub escrow: &'a AccountView,
    pub extensions: &'a AccountView,
    pub system_program: &'a AccountView,
    pub event_authority: &'a AccountView,
    pub escrow_program: &'a AccountView,
}

impl<'a> TryFrom<&'a [AccountView]> for SetSettlementAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let [payer, admin, escrow, extensions, system_program, event_authority, escrow_program] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        // 1. Validate signers
        verify_signer(payer, true)?;
        verify_signer(admin, false)?;

        // 2. Validate writable
        verify_writable(extensions, true)?;

        // 3. Validate readonly
        verify_readonly(escrow)?;

        // 4. Validate program IDs
        verify_system_program(system_program)?;
        verify_current_program(escrow_program)?;
        verify_event_authority(event_authority)?;

        // 5. Validate accounts owned by current program
        verify_current_program_account(escrow)?;

        Ok(Self { payer, admin, escrow, extensions, system_program, event_authority, escrow_program })
    }
}

impl<'a> InstructionAccounts<'a> for SetSettlementAccounts<'a> {}
