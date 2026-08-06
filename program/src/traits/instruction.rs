use pinocchio::{account::AccountView, error::ProgramError};

/// Discriminators for the Escrow Program instructions.
#[repr(u8)]
pub enum EscrowInstructionDiscriminators {
    CreateEscrow = 0,
    AddTimelock = 1,
    SetHook = 2,
    Deposit = 3,
    UpdateAdmin = 4,
    Withdraw = 5,
    AllowMint = 6,
    BlockMint = 7,
    BlockTokenExtension = 8,
    SetArbiter = 9,
    RemoveExtension = 10,
    UnblockTokenExtension = 11,
    SetImmutable = 12,
    SetSettlement = 13,
    Approve = 14,
    RaiseDispute = 15,
    Resolve = 16,
    EmitEvent = 228,
}

impl TryFrom<u8> for EscrowInstructionDiscriminators {
    type Error = ProgramError;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Self::CreateEscrow),
            1 => Ok(Self::AddTimelock),
            2 => Ok(Self::SetHook),
            3 => Ok(Self::Deposit),
            4 => Ok(Self::UpdateAdmin),
            5 => Ok(Self::Withdraw),
            6 => Ok(Self::AllowMint),
            7 => Ok(Self::BlockMint),
            8 => Ok(Self::BlockTokenExtension),
            9 => Ok(Self::SetArbiter),
            10 => Ok(Self::RemoveExtension),
            11 => Ok(Self::UnblockTokenExtension),
            12 => Ok(Self::SetImmutable),
            13 => Ok(Self::SetSettlement),
            14 => Ok(Self::Approve),
            15 => Ok(Self::RaiseDispute),
            16 => Ok(Self::Resolve),
            228 => Ok(Self::EmitEvent),
            _ => Err(ProgramError::InvalidInstructionData),
        }
    }
}

/// Marker trait for instruction account structs
///
/// Implementors should use TryFrom<&'a [AccountView]> for parsing
pub trait InstructionAccounts<'a>: Sized + TryFrom<&'a [AccountView], Error = ProgramError> {}

/// Marker trait for instruction data structs
///
/// Implementors should use TryFrom<&'a [u8]> for parsing
pub trait InstructionData<'a>: Sized + TryFrom<&'a [u8], Error = ProgramError> {
    /// Expected length of instruction data
    const LEN: usize;
}

/// Full instruction combining accounts and data
///
/// Implementors get automatic TryFrom<(&'a [u8], &'a [AccountView])>
pub trait Instruction<'a>: Sized {
    type Accounts: InstructionAccounts<'a>;
    type Data: InstructionData<'a>;

    fn accounts(&self) -> &Self::Accounts;
    fn data(&self) -> &Self::Data;

    /// Parse instruction from data and accounts tuple
    #[inline(always)]
    fn parse(data: &'a [u8], accounts: &'a [AccountView]) -> Result<Self, ProgramError>
    where
        Self: From<(Self::Accounts, Self::Data)>,
    {
        let accounts = Self::Accounts::try_from(accounts)?;
        let data = Self::Data::try_from(data)?;
        Ok(Self::from((accounts, data)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_discriminator_try_from_create_escrow() {
        let result = EscrowInstructionDiscriminators::try_from(0u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::CreateEscrow));
    }

    #[test]
    fn test_discriminator_try_from_add_timelock() {
        let result = EscrowInstructionDiscriminators::try_from(1u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::AddTimelock));
    }

    #[test]
    fn test_discriminator_try_from_set_hook() {
        let result = EscrowInstructionDiscriminators::try_from(2u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::SetHook));
    }

    #[test]
    fn test_discriminator_try_from_deposit() {
        let result = EscrowInstructionDiscriminators::try_from(3u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::Deposit));
    }

    #[test]
    fn test_discriminator_try_from_emit_event() {
        let result = EscrowInstructionDiscriminators::try_from(228u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::EmitEvent));
    }

    #[test]
    fn test_discriminator_try_from_update_admin() {
        let result = EscrowInstructionDiscriminators::try_from(4u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::UpdateAdmin));
    }

    #[test]
    fn test_discriminator_try_from_withdraw() {
        let result = EscrowInstructionDiscriminators::try_from(5u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::Withdraw));
    }

    #[test]
    fn test_discriminator_try_from_allow_mint() {
        let result = EscrowInstructionDiscriminators::try_from(6u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::AllowMint));
    }

    #[test]
    fn test_discriminator_try_from_block_mint() {
        let result = EscrowInstructionDiscriminators::try_from(7u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::BlockMint));
    }

    #[test]
    fn test_discriminator_try_from_set_arbiter() {
        let result = EscrowInstructionDiscriminators::try_from(9u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::SetArbiter));
    }

    #[test]
    fn test_discriminator_try_from_remove_extension() {
        let result = EscrowInstructionDiscriminators::try_from(10u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::RemoveExtension));
    }

    #[test]
    fn test_discriminator_try_from_unblock_token_extension() {
        let result = EscrowInstructionDiscriminators::try_from(11u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::UnblockTokenExtension));
    }

    #[test]
    fn test_discriminator_try_from_set_immutable() {
        let result = EscrowInstructionDiscriminators::try_from(12u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::SetImmutable));
    }

    #[test]
    fn test_discriminator_try_from_set_settlement() {
        let result = EscrowInstructionDiscriminators::try_from(13u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::SetSettlement));
    }

    #[test]
    fn test_discriminator_try_from_approve() {
        let result = EscrowInstructionDiscriminators::try_from(14u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::Approve));
    }

    #[test]
    fn test_discriminator_try_from_raise_dispute() {
        let result = EscrowInstructionDiscriminators::try_from(15u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::RaiseDispute));
    }

    #[test]
    fn test_discriminator_try_from_resolve() {
        let result = EscrowInstructionDiscriminators::try_from(16u8);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), EscrowInstructionDiscriminators::Resolve));
    }

    #[test]
    fn test_discriminator_try_from_invalid() {
        let result = EscrowInstructionDiscriminators::try_from(17u8);
        assert!(matches!(result, Err(ProgramError::InvalidInstructionData)));

        let result = EscrowInstructionDiscriminators::try_from(255u8);
        assert!(matches!(result, Err(ProgramError::InvalidInstructionData)));

        let result = EscrowInstructionDiscriminators::try_from(100u8);
        assert!(matches!(result, Err(ProgramError::InvalidInstructionData)));
    }
}
