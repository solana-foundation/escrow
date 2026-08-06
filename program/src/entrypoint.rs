use pinocchio::{account::AccountView, entrypoint, error::ProgramError, Address, ProgramResult};

use crate::{
    instructions::{
        process_add_timelock, process_allow_mint, process_block_mint, process_block_token_extension,
        process_create_escrow, process_deposit, process_emit_event, process_remove_extension, process_set_arbiter,
        process_set_hook, process_set_immutable, process_unblock_token_extension, process_update_admin,
        process_approve, process_raise_dispute, process_resolve, process_set_settlement, process_withdraw,
    },
    traits::EscrowInstructionDiscriminators,
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Address,
    accounts: &mut [AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let (discriminator, instruction_data) =
        instruction_data.split_first().ok_or(ProgramError::InvalidInstructionData)?;

    let ix_discriminator = EscrowInstructionDiscriminators::try_from(*discriminator)?;

    match ix_discriminator {
        EscrowInstructionDiscriminators::CreateEscrow => process_create_escrow(program_id, accounts, instruction_data),
        EscrowInstructionDiscriminators::AddTimelock => process_add_timelock(program_id, accounts, instruction_data),
        EscrowInstructionDiscriminators::SetHook => process_set_hook(program_id, accounts, instruction_data),
        EscrowInstructionDiscriminators::Deposit => process_deposit(program_id, accounts, instruction_data),
        EscrowInstructionDiscriminators::UpdateAdmin => process_update_admin(program_id, accounts, instruction_data),
        EscrowInstructionDiscriminators::Withdraw => process_withdraw(program_id, accounts, instruction_data),
        EscrowInstructionDiscriminators::AllowMint => process_allow_mint(program_id, accounts, instruction_data),
        EscrowInstructionDiscriminators::BlockMint => process_block_mint(program_id, accounts, instruction_data),
        EscrowInstructionDiscriminators::BlockTokenExtension => {
            process_block_token_extension(program_id, accounts, instruction_data)
        }
        EscrowInstructionDiscriminators::RemoveExtension => {
            process_remove_extension(program_id, accounts, instruction_data)
        }
        EscrowInstructionDiscriminators::UnblockTokenExtension => {
            process_unblock_token_extension(program_id, accounts, instruction_data)
        }
        EscrowInstructionDiscriminators::SetArbiter => process_set_arbiter(program_id, accounts, instruction_data),
        EscrowInstructionDiscriminators::SetImmutable => process_set_immutable(program_id, accounts, instruction_data),
        EscrowInstructionDiscriminators::SetSettlement => {
            process_set_settlement(program_id, accounts, instruction_data)
        }
        EscrowInstructionDiscriminators::Approve => process_approve(program_id, accounts, instruction_data),
        EscrowInstructionDiscriminators::RaiseDispute => process_raise_dispute(program_id, accounts, instruction_data),
        EscrowInstructionDiscriminators::Resolve => process_resolve(program_id, accounts, instruction_data),
        EscrowInstructionDiscriminators::EmitEvent => process_emit_event(program_id, accounts),
    }
}
