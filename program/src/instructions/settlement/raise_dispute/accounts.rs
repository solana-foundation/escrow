use pinocchio::{account::AccountView, error::ProgramError};

use crate::{
    traits::InstructionAccounts,
    utils::{
        verify_current_program, verify_current_program_account, verify_event_authority, verify_readonly, verify_signer,
        verify_system_program, verify_writable,
    },
};

/// Accounts for the RaiseDispute instruction (the lock).
///
/// # Account Layout
/// 0. `[signer]` disputer - Depositor (buyer) or beneficiary (seller)
/// 1. `[]` escrow - Escrow PDA
/// 2. `[writable]` extensions - Settlement extension (mutated: disputed=true, pin offset/PDA)
/// 3. `[]` receipt - Deposit receipt (identifies the depositor)
/// 4. `[]` dispute_pda - Verdict account supplied by the disputer; must be owned by the
///    configured dispute program (checked in the processor)
/// 5. `[]` system_program - System program
/// 6. `[]` event_authority - Event authority PDA
/// 7. `[]` escrow_program - Current program
pub struct RaiseDisputeAccounts<'a> {
    pub disputer: &'a AccountView,
    pub escrow: &'a AccountView,
    pub extensions: &'a AccountView,
    pub receipt: &'a AccountView,
    pub dispute_pda: &'a AccountView,
    pub system_program: &'a AccountView,
    pub event_authority: &'a AccountView,
    pub escrow_program: &'a AccountView,
}

impl<'a> TryFrom<&'a [AccountView]> for RaiseDisputeAccounts<'a> {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
        let [disputer, escrow, extensions, receipt, dispute_pda, system_program, event_authority, escrow_program] = accounts
        else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        // 1. Validate signers
        verify_signer(disputer, false)?;

        // 2. Validate writable
        verify_writable(extensions, true)?;

        // 3. Validate readonly
        verify_readonly(escrow)?;
        verify_readonly(receipt)?;
        verify_readonly(dispute_pda)?;

        // 4. Validate program IDs
        verify_system_program(system_program)?;
        verify_current_program(escrow_program)?;
        verify_event_authority(event_authority)?;

        // 5. Validate accounts owned by current program
        verify_current_program_account(escrow)?;
        verify_current_program_account(receipt)?;

        Ok(Self { disputer, escrow, extensions, receipt, dispute_pda, system_program, event_authority, escrow_program })
    }
}

impl<'a> InstructionAccounts<'a> for RaiseDisputeAccounts<'a> {}
