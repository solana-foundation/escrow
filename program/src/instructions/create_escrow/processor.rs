use alloc::vec::Vec;
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, Address, ProgramResult};

use crate::{
    events::CreatesEscrowEvent,
    instructions::CreateEscrow,
    state::Escrow,
    traits::{AccountSerialize, AccountSize, EventSerialize, PdaSeeds},
    utils::{create_pda_account, emit_event},
};

/// Processes the CreateEscrow instruction.
///
/// Creates an Escrow PDA with the specified admin.
pub fn process_create_escrow(program_id: &Address, accounts: &[AccountView], instruction_data: &[u8]) -> ProgramResult {
    let ix = CreateEscrow::try_from((instruction_data, accounts))?;

    // Create Escrow state
    let escrow = Escrow::new(ix.data.bump, *ix.accounts.escrow_seed.address(), *ix.accounts.admin.address(), false);

    // Validate Escrow PDA
    escrow.validate_pda(ix.accounts.escrow, program_id, ix.data.bump)?;

    // Get seeds for Escrow account creation
    let escrow_bump_seed = [ix.data.bump];
    let escrow_seeds: Vec<Seed> = escrow.seeds_with_bump(&escrow_bump_seed);
    let escrow_seeds_array: [Seed; 3] = escrow_seeds.try_into().map_err(|_| ProgramError::InvalidArgument)?;

    // Create the Escrow account
    create_pda_account(ix.accounts.payer, Escrow::LEN, program_id, ix.accounts.escrow, escrow_seeds_array)?;

    // Write serialized Escrow data to the account
    let mut escrow_account = *ix.accounts.escrow;
    let mut escrow_data_slice = escrow_account.try_borrow_mut()?;
    escrow.write_to_slice(&mut escrow_data_slice)?;

    // Emit event via CPI
    let event = CreatesEscrowEvent::new(*ix.accounts.escrow_seed.address(), *ix.accounts.admin.address());
    emit_event(program_id, ix.accounts.event_authority, ix.accounts.escrow_program, &event.to_bytes())?;

    Ok(())
}
