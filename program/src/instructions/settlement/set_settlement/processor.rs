use alloc::vec::Vec;
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, Address, ProgramResult};

use crate::{
    errors::EscrowProgramError,
    events::SettlementConfiguredEvent,
    instructions::SetSettlement,
    state::{update_or_append_extension, Escrow, ExtensionType, ExtensionsPda, SettlementData},
    traits::{EventSerialize, ExtensionData, PdaSeeds},
    utils::emit_event,
};

/// Processes the SetSettlement instruction.
///
/// Configures two-party settlement (beneficiary + dispute program) on an escrow.
/// Creates extensions PDA if it doesn't exist. Idempotent while the escrow is mutable.
pub fn process_set_settlement(program_id: &Address, accounts: &[AccountView], instruction_data: &[u8]) -> ProgramResult {
    let ix = SetSettlement::try_from((instruction_data, accounts))?;

    // release_value must not collide with the pending sentinel (255).
    if ix.data.release_value == crate::state::VERDICT_PENDING {
        return Err(EscrowProgramError::InvalidReleaseValue.into());
    }

    // Read escrow and validate
    let escrow_data = ix.accounts.escrow.try_borrow()?;
    let escrow = Escrow::from_account(&escrow_data, ix.accounts.escrow, program_id)?;
    escrow.validate_admin(ix.accounts.admin.address())?;
    escrow.require_mutable()?;

    // Validate extensions PDA
    let extensions_pda = ExtensionsPda::new(ix.accounts.escrow.address());
    extensions_pda.validate_pda(ix.accounts.extensions, program_id, ix.data.extensions_bump)?;

    // Build extension data
    let settlement = SettlementData::new_config(
        ix.data.beneficiary,
        ix.data.dispute_program,
        ix.data.release_value,
    );
    let settlement_bytes = settlement.to_bytes();

    // Get seeds and append/update extension
    let extensions_bump_seed = [ix.data.extensions_bump];
    let extensions_seeds: Vec<Seed> = extensions_pda.seeds_with_bump(&extensions_bump_seed);
    let extensions_seeds_array: [Seed; 3] = extensions_seeds.try_into().map_err(|_| ProgramError::InvalidArgument)?;

    update_or_append_extension(
        ix.accounts.payer,
        ix.accounts.extensions,
        program_id,
        ix.data.extensions_bump,
        ExtensionType::Settlement,
        &settlement_bytes,
        extensions_seeds_array,
    )?;

    // Emit event
    let event = SettlementConfiguredEvent::new(
        *ix.accounts.escrow.address(),
        ix.data.beneficiary,
        ix.data.dispute_program,
        ix.data.release_value,
    );
    emit_event(program_id, ix.accounts.event_authority, ix.accounts.escrow_program, &event.to_bytes())?;

    Ok(())
}
