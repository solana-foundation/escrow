use pinocchio::{error::ProgramError, Address};

use crate::{require_len, traits::InstructionData};

/// Instruction data for SetSettlement
///
/// # Layout
/// * `extensions_bump` (u8) - Bump for extensions PDA
/// * `beneficiary` (Address) - Seller / payout target
/// * `dispute_program` (Address) - Trusted owner of any verdict PDA
/// * `release_value` (u8) - Verdict byte meaning "pay seller" (must be != 255)
pub struct SetSettlementData {
    pub extensions_bump: u8,
    pub beneficiary: Address,
    pub dispute_program: Address,
    pub release_value: u8,
}

impl<'a> TryFrom<&'a [u8]> for SetSettlementData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        require_len!(data, Self::LEN);

        Ok(Self {
            extensions_bump: data[0],
            beneficiary: Address::new_from_array(data[1..33].try_into().unwrap()),
            dispute_program: Address::new_from_array(data[33..65].try_into().unwrap()),
            release_value: data[65],
        })
    }
}

impl<'a> InstructionData<'a> for SetSettlementData {
    const LEN: usize = 1 + 32 + 32 + 1; // 66
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_set_settlement_data_valid() {
        let mut data = [0u8; 66];
        data[0] = 254; // extensions_bump
        data[1..33].copy_from_slice(&[1u8; 32]); // beneficiary
        data[33..65].copy_from_slice(&[2u8; 32]); // dispute_program
        data[65] = 7; // release_value

        let parsed = SetSettlementData::try_from(&data[..]).unwrap();
        assert_eq!(parsed.extensions_bump, 254);
        assert_eq!(parsed.beneficiary, Address::new_from_array([1u8; 32]));
        assert_eq!(parsed.dispute_program, Address::new_from_array([2u8; 32]));
        assert_eq!(parsed.release_value, 7);
    }

    #[test]
    fn test_set_settlement_data_empty() {
        let data: [u8; 0] = [];
        let result = SetSettlementData::try_from(&data[..]);
        assert!(matches!(result, Err(ProgramError::InvalidInstructionData)));
    }
}
