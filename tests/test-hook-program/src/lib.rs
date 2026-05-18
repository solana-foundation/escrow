//! Test Hook Program for LiteSVM Integration Tests
//!
//! Two variants via feature flags:
//! - allow: Accepts all operations
//! - deny: Rejects all operations

#![no_std]

extern crate alloc;

use pinocchio::{account::AccountView, Address, ProgramResult};

pinocchio::program_entrypoint!(process_instruction);
pinocchio::default_allocator!();
pinocchio::nostd_panic_handler!();

#[cfg(feature = "allow")]
pub fn process_instruction(_program_id: &Address, accounts: &mut [AccountView], instruction_data: &[u8]) -> ProgramResult {
    use pinocchio::error::ProgramError;

    // Validate core context shape so integration tests catch missing account context.
    // hook_point: 0=PreDeposit, 1=PostDeposit, 2=PreWithdraw, 3=PostWithdraw
    let hook_point = *instruction_data.first().ok_or(ProgramError::InvalidInstructionData)?;
    match hook_point {
        0..=1 => {
            if accounts.len() < 3 {
                return Err(ProgramError::Custom(42));
            }
        }
        2..=3 => {
            if accounts.len() < 4 {
                return Err(ProgramError::Custom(42));
            }
        }
        _ => return Err(ProgramError::InvalidInstructionData),
    }

    Ok(())
}

#[cfg(feature = "deny")]
pub fn process_instruction(
    _program_id: &Address,
    _accounts: &mut [AccountView],
    _instruction_data: &[u8],
) -> ProgramResult {
    use pinocchio::error::ProgramError;
    Err(ProgramError::Custom(1))
}

#[cfg(not(any(feature = "allow", feature = "deny")))]
pub fn process_instruction(
    _program_id: &Address,
    _accounts: &mut [AccountView],
    _instruction_data: &[u8],
) -> ProgramResult {
    Ok(())
}
