use pinocchio::error::ProgramError;

use crate::traits::InstructionData;

/// Instruction data for Resolve (empty — verdict source is the dispute PDA pinned at RaiseDispute).
pub struct ResolveData {}

impl<'a> TryFrom<&'a [u8]> for ResolveData {
    type Error = ProgramError;

    #[inline(always)]
    fn try_from(_data: &'a [u8]) -> Result<Self, Self::Error> {
        Ok(Self {})
    }
}

impl<'a> InstructionData<'a> for ResolveData {
    const LEN: usize = 0;
}
