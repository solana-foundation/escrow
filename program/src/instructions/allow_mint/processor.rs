use alloc::vec::Vec;
use pinocchio::{account::AccountView, cpi::Seed, error::ProgramError, Address, ProgramResult};
use pinocchio_associated_token_account::instructions::CreateIdempotent;

use crate::{
    events::AllowMintEvent,
    instructions::AllowMint,
    state::{AllowedMint, AllowedMintPda, Escrow, ExtensionsPda},
    traits::{AccountSerialize, AccountSize, EventSerialize, PdaSeeds},
    utils::{create_pda_account, emit_event, validate_mint_extensions},
};

/// Processes the AllowMint instruction.
///
/// Creates an AllowedMint PDA, enabling deposits of that mint into the escrow.
pub fn process_allow_mint(program_id: &Address, accounts: &[AccountView], instruction_data: &[u8]) -> ProgramResult {
    let ix = AllowMint::try_from((instruction_data, accounts))?;

    // Verify escrow exists and validate admin
    let escrow_data = ix.accounts.escrow.try_borrow()?;
    let escrow = Escrow::from_account(&escrow_data, ix.accounts.escrow, program_id)?;
    escrow.validate_admin(ix.accounts.admin.address())?;

    // Validate AllowedMint PDA using external seeds
    let pda_seeds = AllowedMintPda::new(ix.accounts.escrow.address(), ix.accounts.mint.address());
    pda_seeds.validate_pda(ix.accounts.allowed_mint, program_id, ix.data.bump)?;

    // Validate escrow_extensions is the correct PDA for this escrow
    let extensions_pda = ExtensionsPda::new(ix.accounts.escrow.address());
    extensions_pda.validate_pda_address(ix.accounts.escrow_extensions, &crate::ID)?;
    validate_mint_extensions(ix.accounts.mint, ix.accounts.escrow_extensions)?;

    // Get seeds for AllowedMint account creation
    let allowed_mint_bump_seed = [ix.data.bump];
    let allowed_mint_seeds: Vec<Seed> = pda_seeds.seeds_with_bump(&allowed_mint_bump_seed);
    let allowed_mint_seeds_array: [Seed; 4] =
        allowed_mint_seeds.try_into().map_err(|_| ProgramError::InvalidArgument)?;

    // Create the AllowedMint PDA account
    create_pda_account(
        ix.accounts.payer,
        AllowedMint::LEN,
        program_id,
        ix.accounts.allowed_mint,
        allowed_mint_seeds_array,
    )?;

    // Create AllowedMint state (only stores bump)
    let allowed_mint = AllowedMint::new(ix.data.bump);

    // Write serialized AllowedMint data to the account
    let mut allowed_mint_account = *ix.accounts.allowed_mint;
    let mut allowed_mint_data_slice = allowed_mint_account.try_borrow_mut()?;
    allowed_mint.write_to_slice(&mut allowed_mint_data_slice)?;
    drop(allowed_mint_data_slice);

    // Create vault ATA for the escrow
    CreateIdempotent {
        funding_account: ix.accounts.payer,
        account: ix.accounts.vault,
        wallet: ix.accounts.escrow,
        mint: ix.accounts.mint,
        system_program: ix.accounts.system_program,
        token_program: ix.accounts.token_program,
    }
    .invoke()?;

    // Emit event via CPI
    let event = AllowMintEvent::new(*ix.accounts.escrow.address(), *ix.accounts.mint.address());
    emit_event(program_id, ix.accounts.event_authority, ix.accounts.escrow_program, &event.to_bytes())?;

    Ok(())
}
