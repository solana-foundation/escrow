use alloc::vec::Vec;
use codama::CodamaType;
use pinocchio::Address;

use crate::traits::{EventDiscriminator, EventDiscriminators, EventSerialize};

/// Emitted by `SetSettlement`.
#[derive(CodamaType)]
pub struct SettlementConfiguredEvent {
    pub escrow: Address,
    pub beneficiary: Address,
    pub dispute_program: Address,
    pub release_value: u8,
}

impl EventDiscriminator for SettlementConfiguredEvent {
    const DISCRIMINATOR: u8 = EventDiscriminators::SettlementConfigured as u8;
}

impl EventSerialize for SettlementConfiguredEvent {
    #[inline(always)]
    fn to_bytes_inner(&self) -> Vec<u8> {
        let mut data = Vec::with_capacity(Self::DATA_LEN);
        data.extend_from_slice(self.escrow.as_ref());
        data.extend_from_slice(self.beneficiary.as_ref());
        data.extend_from_slice(self.dispute_program.as_ref());
        data.push(self.release_value);
        data
    }
}

impl SettlementConfiguredEvent {
    pub const DATA_LEN: usize = 32 + 32 + 32 + 1; // escrow + beneficiary + dispute_program + release_value

    #[inline(always)]
    pub fn new(escrow: Address, beneficiary: Address, dispute_program: Address, release_value: u8) -> Self {
        Self { escrow, beneficiary, dispute_program, release_value }
    }
}

/// Emitted by `RaiseDispute`.
#[derive(CodamaType)]
pub struct DisputeRaisedEvent {
    pub escrow: Address,
    pub dispute_pda: Address,
    pub offset: u16,
}

impl EventDiscriminator for DisputeRaisedEvent {
    const DISCRIMINATOR: u8 = EventDiscriminators::DisputeRaised as u8;
}

impl EventSerialize for DisputeRaisedEvent {
    #[inline(always)]
    fn to_bytes_inner(&self) -> Vec<u8> {
        let mut data = Vec::with_capacity(Self::DATA_LEN);
        data.extend_from_slice(self.escrow.as_ref());
        data.extend_from_slice(self.dispute_pda.as_ref());
        data.extend_from_slice(&self.offset.to_le_bytes());
        data
    }
}

impl DisputeRaisedEvent {
    pub const DATA_LEN: usize = 32 + 32 + 2; // escrow + dispute_pda + offset

    #[inline(always)]
    pub fn new(escrow: Address, dispute_pda: Address, offset: u16) -> Self {
        Self { escrow, dispute_pda, offset }
    }
}

/// Emitted by cooperative `Approve` release and by `Resolve`.
/// `recipient` is the party that received the funds (beneficiary or depositor).
#[derive(CodamaType)]
pub struct ReleaseEvent {
    pub escrow: Address,
    pub recipient: Address,
    pub mint: Address,
    pub amount: u64,
}

impl EventDiscriminator for ReleaseEvent {
    const DISCRIMINATOR: u8 = EventDiscriminators::Release as u8;
}

impl EventSerialize for ReleaseEvent {
    #[inline(always)]
    fn to_bytes_inner(&self) -> Vec<u8> {
        let mut data = Vec::with_capacity(Self::DATA_LEN);
        data.extend_from_slice(self.escrow.as_ref());
        data.extend_from_slice(self.recipient.as_ref());
        data.extend_from_slice(self.mint.as_ref());
        data.extend_from_slice(&self.amount.to_le_bytes());
        data
    }
}

impl ReleaseEvent {
    pub const DATA_LEN: usize = 32 + 32 + 32 + 8; // escrow + recipient + mint + amount

    #[inline(always)]
    pub fn new(escrow: Address, recipient: Address, mint: Address, amount: u64) -> Self {
        Self { escrow, recipient, mint, amount }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::events::EVENT_IX_TAG_LE;
    use crate::traits::EVENT_DISCRIMINATOR_LEN;

    #[test]
    fn test_settlement_configured_event_bytes() {
        let e = SettlementConfiguredEvent::new(
            Address::new_from_array([1u8; 32]),
            Address::new_from_array([2u8; 32]),
            Address::new_from_array([3u8; 32]),
            7,
        );
        let bytes = e.to_bytes();
        assert_eq!(bytes.len(), EVENT_DISCRIMINATOR_LEN + SettlementConfiguredEvent::DATA_LEN);
        assert_eq!(&bytes[..8], EVENT_IX_TAG_LE);
        assert_eq!(bytes[8], EventDiscriminators::SettlementConfigured as u8);
    }

    #[test]
    fn test_release_event_bytes() {
        let e = ReleaseEvent::new(
            Address::new_from_array([1u8; 32]),
            Address::new_from_array([2u8; 32]),
            Address::new_from_array([3u8; 32]),
            1000,
        );
        let bytes = e.to_bytes();
        assert_eq!(bytes.len(), EVENT_DISCRIMINATOR_LEN + ReleaseEvent::DATA_LEN);
        assert_eq!(bytes[8], EventDiscriminators::Release as u8);
    }
}
