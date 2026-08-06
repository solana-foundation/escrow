use pinocchio::error::ProgramError;

use crate::{require_len, traits::InstructionData};

/// Instruction data for RaiseDispute
///
/// # Layout
/// * `offset` (u16) - Byte offset of the verdict within the dispute PDA
pub struct RaiseDisputeData {
    pub offset: u16,
}

impl<'a> TryFrom<&'a [u8]> for RaiseDisputeData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        require_len!(data, Self::LEN);

        Ok(Self { offset: u16::from_le_bytes([data[0], data[1]]) })
    }
}

impl<'a> InstructionData<'a> for RaiseDisputeData {
    const LEN: usize = 2;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_raise_dispute_data_valid() {
        let data = 42u16.to_le_bytes();
        let parsed = RaiseDisputeData::try_from(&data[..]).unwrap();
        assert_eq!(parsed.offset, 42);
    }

    #[test]
    fn test_raise_dispute_data_empty() {
        let data: [u8; 0] = [];
        let result = RaiseDisputeData::try_from(&data[..]);
        assert!(matches!(result, Err(ProgramError::InvalidInstructionData)));
    }
}
