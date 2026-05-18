use pinocchio::{account::AccountView, Address, ProgramResult};

use crate::{
    events::AdminUpdateEvent,
    instructions::UpdateAdmin,
    state::Escrow,
    traits::{AccountSerialize, EventSerialize},
    utils::emit_event,
};

/// Processes the UpdateAdmin instruction.
///
/// Updates the admin on an escrow. Only the current admin can update to a new admin.
pub fn process_update_admin(program_id: &Address, accounts: &[AccountView], instruction_data: &[u8]) -> ProgramResult {
    let ix = UpdateAdmin::try_from((instruction_data, accounts))?;

    // Read and validate escrow
    let escrow_data = ix.accounts.escrow.try_borrow()?;
    let escrow = Escrow::from_account(&escrow_data, ix.accounts.escrow, program_id)?;
    escrow.validate_admin(ix.accounts.admin.address())?;

    // Copy values we need for the update
    let old_admin = escrow.admin;
    let updated_escrow =
        Escrow::new(escrow.bump, escrow.escrow_seed, *ix.accounts.new_admin.address(), escrow.is_immutable);
    drop(escrow_data);

    // Write updated escrow
    let mut escrow_account = *ix.accounts.escrow;
    let mut escrow_data = escrow_account.try_borrow_mut()?;
    updated_escrow.write_to_slice(&mut escrow_data)?;

    // Emit event
    let event = AdminUpdateEvent::new(*ix.accounts.escrow.address(), old_admin, *ix.accounts.new_admin.address());
    emit_event(program_id, ix.accounts.event_authority, ix.accounts.escrow_program, &event.to_bytes())?;

    Ok(())
}
