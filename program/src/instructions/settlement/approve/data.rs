use pinocchio::error::ProgramError;

use crate::traits::InstructionData;

/// Instruction data for Approve (empty — all context comes from accounts).
pub struct ApproveData {}

impl<'a> TryFrom<&'a [u8]> for ApproveData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(_data: &'a [u8]) -> Result<Self, Self::Error> {
        Ok(Self {})
    }
}

impl<'a> InstructionData<'a> for ApproveData {
    const LEN: usize = 0;
}
