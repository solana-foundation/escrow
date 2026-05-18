use alloc::vec::Vec;
use pinocchio::{
    account::AccountView,
    cpi::invoke_with_bounds,
    error::ProgramError,
    instruction::{InstructionAccount, InstructionView},
    Address, ProgramResult,
};

use crate::{assert_no_padding, errors::EscrowProgramError, require_len, traits::ExtensionData};

/// Hook points for escrow operations
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum HookPoint {
    PreDeposit = 0,
    PostDeposit = 1,
    PreWithdraw = 2,
    PostWithdraw = 3,
}

/// Hook extension data (stored in TLV format)
///
/// Stores the hook program address that will be invoked during escrow operations.
#[derive(Clone, Copy, Debug, PartialEq)]
#[repr(C)]
pub struct HookData {
    pub hook_program: Address,
}

assert_no_padding!(HookData, 32);

impl HookData {
    pub const LEN: usize = 32;

    pub fn new(hook_program: Address) -> Self {
        Self { hook_program }
    }

    /// Validates that the hook program account matches the stored address
    pub fn validate(&self, remaining_accounts: &[AccountView]) -> ProgramResult {
        let hook_program = remaining_accounts.first().ok_or(EscrowProgramError::HookProgramMismatch)?;
        if hook_program.address() != &self.hook_program {
            return Err(EscrowProgramError::HookProgramMismatch.into());
        }
        Ok(())
    }

    /// Validates and invokes the hook program.
    ///
    /// Important: hook execution is fail-closed. Any hook CPI error aborts the
    /// parent escrow instruction. If an escrow is set immutable with a hook
    /// configured, this external dependency is permanently embedded.
    ///
    /// # Arguments
    /// * `hook_point` - The hook point discriminator
    /// * `remaining_accounts` - Remaining accounts slice: [hook_program, extra_accounts...]
    /// * `core_accounts` - Core accounts to pass to hook (escrow, mint, receipt)
    ///
    /// # Returns
    /// * `Ok(())` if hook succeeds
    /// * `Err(HookRejected)` if hook returns error or remaining_accounts is invalid
    pub fn invoke(
        &self,
        hook_point: HookPoint,
        remaining_accounts: &[AccountView],
        core_accounts: &[&AccountView],
    ) -> ProgramResult {
        self.validate(remaining_accounts)?;

        let extra_accounts = remaining_accounts.get(1..).unwrap_or(&[]);
        let all_accounts: Vec<&AccountView> = core_accounts.iter().copied().chain(extra_accounts.iter()).collect();

        // Build instruction accounts with least privilege for hook CPI
        // (read-only + non-signer regardless of caller flags).
        let instruction_accounts: Vec<InstructionAccount> =
            all_accounts.iter().map(|acc| InstructionAccount::new(acc.address(), false, false)).collect();

        // Instruction data is just the 1-byte hook point discriminator
        let instruction_data = [hook_point as u8];

        let instruction = InstructionView {
            program_id: &self.hook_program,
            accounts: &instruction_accounts,
            data: &instruction_data,
        };

        // Preserve a stable escrow error surface for all hook CPI failures.
        invoke_with_bounds::<16, _>(&instruction, &all_accounts).map_err(|_| EscrowProgramError::HookRejected.into())
    }
}

impl ExtensionData for HookData {
    fn to_bytes(&self) -> Vec<u8> {
        self.hook_program.as_array().to_vec()
    }

    fn from_bytes(data: &[u8]) -> Result<Self, ProgramError> {
        require_len!(data, Self::LEN);

        Ok(Self { hook_program: Address::new_from_array(data[0..32].try_into().unwrap()) })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hook_data_new() {
        let program = Address::new_from_array([1u8; 32]);
        let hook = HookData::new(program);
        assert_eq!(hook.hook_program, program);
    }

    #[test]
    fn test_hook_data_roundtrip() {
        let program = Address::new_from_array([2u8; 32]);
        let hook = HookData::new(program);
        let bytes = hook.to_bytes();
        let parsed = HookData::from_bytes(&bytes).unwrap();
        assert_eq!(parsed, hook);
    }
}
