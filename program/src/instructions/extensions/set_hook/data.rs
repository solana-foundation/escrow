use pinocchio::{error::ProgramError, Address};

use crate::{require_len, traits::InstructionData};

/// Instruction data for SetHook
///
/// # Layout
/// * `extensions_bump` (u8) - Bump for extensions PDA
/// * `hook_program` (Address) - Hook program address (use RemoveExtension to disable)
pub struct SetHookData {
    pub extensions_bump: u8,
    pub hook_program: Address,
}

impl<'a> TryFrom<&'a [u8]> for SetHookData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        require_len!(data, Self::LEN);

        let hook_program = Address::new_from_array(data[1..33].try_into().unwrap());
        if hook_program == Address::default() {
            return Err(ProgramError::InvalidArgument);
        }

        Ok(Self { extensions_bump: data[0], hook_program })
    }
}

impl<'a> InstructionData<'a> for SetHookData {
    const LEN: usize = 1 + 32; // 33 bytes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_set_hook_data_try_from_valid() {
        let mut data = [0u8; 33];
        data[0] = 255; // extensions_bump
        data[1..33].copy_from_slice(&[1u8; 32]); // hook_program

        let result = SetHookData::try_from(&data[..]);
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.extensions_bump, 255);
        assert_eq!(parsed.hook_program, Address::new_from_array([1u8; 32]));
    }

    #[test]
    fn test_set_hook_data_rejects_zero_hook_program() {
        let mut data = [0u8; 33];
        data[0] = 1;

        let result = SetHookData::try_from(&data[..]);
        assert!(matches!(result, Err(ProgramError::InvalidArgument)));
    }

    #[test]
    fn test_set_hook_data_try_from_empty() {
        let data: [u8; 0] = [];
        let result = SetHookData::try_from(&data[..]);
        assert!(matches!(result, Err(ProgramError::InvalidInstructionData)));
    }
}
