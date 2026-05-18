use pinocchio::{account::AccountView, Address, ProgramResult};

use crate::{
    events::SetImmutableEvent,
    instructions::SetImmutable,
    state::Escrow,
    traits::{AccountSerialize, EventSerialize},
    utils::emit_event,
};

/// Processes the SetImmutable instruction.
///
/// Locks an escrow configuration so it can no longer be modified.
pub fn process_set_immutable(program_id: &Address, accounts: &[AccountView], instruction_data: &[u8]) -> ProgramResult {
    let ix = SetImmutable::try_from((instruction_data, accounts))?;

    // Read and validate escrow
    let updated_escrow = {
        let escrow_data = ix.accounts.escrow.try_borrow()?;
        let escrow = Escrow::from_account(&escrow_data, ix.accounts.escrow, program_id)?;
        escrow.validate_admin(ix.accounts.admin.address())?;
        escrow.require_mutable()?;
        escrow.set_immutable()
    };

    // Write updated escrow.
    let mut escrow_account = *ix.accounts.escrow;
    let mut escrow_data = escrow_account.try_borrow_mut()?;
    updated_escrow.write_to_slice(&mut escrow_data)?;

    // Emit event
    let event = SetImmutableEvent::new(*ix.accounts.escrow.address(), *ix.accounts.admin.address());
    emit_event(program_id, ix.accounts.event_authority, ix.accounts.escrow_program, &event.to_bytes())?;

    Ok(())
}
