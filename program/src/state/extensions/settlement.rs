use alloc::vec::Vec;
use pinocchio::{account::AccountView, error::ProgramError, Address};

use crate::{assert_no_padding, errors::EscrowProgramError, require_len, traits::ExtensionData};

/// Sentinel verdict byte meaning "dispute not yet resolved". Never a valid `release_value`.
pub const VERDICT_PENDING: u8 = 255;

/// Settlement extension data (stored in TLV format).
///
/// Models a two-party escrow: a `beneficiary` (seller) who may be paid either
/// cooperatively (both parties approve) or via a dispute-program verdict.
///
/// # Field ownership
/// - `beneficiary`, `dispute_program`, `release_value`: set once at `SetSettlement` (admin).
/// - `buyer_approved`, `seller_approved`: flipped by `Approve` (depositor / beneficiary).
/// - `disputed`, `dispute_pda`, `offset`: set by `RaiseDispute`; `disputed` is one-way.
///
/// # Verdict tri-state (read at `Resolve` from `dispute_pda.data()[offset]`)
/// - `== release_value`            → pay seller
/// - `== VERDICT_PENDING` (255)    → `DisputePending` (not resolved)
/// - anything else                 → pay buyer (original depositor)
#[derive(Clone, Copy, Debug, PartialEq)]
#[repr(C)]
pub struct SettlementData {
    pub beneficiary: Address,
    pub dispute_program: Address,
    pub release_value: u8,
    pub buyer_approved: bool,
    pub seller_approved: bool,
    pub disputed: bool,
    pub dispute_pda: Address,
    pub offset: u16,
}

assert_no_padding!(SettlementData, 102);

impl SettlementData {
    pub const LEN: usize = 102;

    /// Initial configuration as written by `SetSettlement`: config set, all
    /// approval / dispute state zeroed.
    pub fn new_config(beneficiary: Address, dispute_program: Address, release_value: u8) -> Self {
        Self {
            beneficiary,
            dispute_program,
            release_value,
            buyer_approved: false,
            seller_approved: false,
            disputed: false,
            dispute_pda: Address::default(),
            offset: 0,
        }
    }

    /// Read the verdict byte from a dispute PDA at the stored offset.
    ///
    /// Caller is responsible for the ownership/address pin (see `Resolve` processor).
    pub fn read_verdict(&self, dispute_pda: &AccountView) -> Result<u8, ProgramError> {
        let data = dispute_pda.try_borrow()?;
        let offset = usize::from(self.offset);
        if offset >= data.len() {
            return Err(EscrowProgramError::VerdictOutOfBounds.into());
        }
        Ok(data[offset])
    }
}

impl ExtensionData for SettlementData {
    fn to_bytes(&self) -> Vec<u8> {
        let mut data = Vec::with_capacity(Self::LEN);
        data.extend_from_slice(self.beneficiary.as_ref());
        data.extend_from_slice(self.dispute_program.as_ref());
        data.push(self.release_value);
        data.push(self.buyer_approved as u8);
        data.push(self.seller_approved as u8);
        data.push(self.disputed as u8);
        data.extend_from_slice(self.dispute_pda.as_ref());
        data.extend_from_slice(&self.offset.to_le_bytes());
        data
    }

    fn from_bytes(data: &[u8]) -> Result<Self, ProgramError> {
        require_len!(data, Self::LEN);

        Ok(Self {
            beneficiary: Address::new_from_array(data[0..32].try_into().unwrap()),
            dispute_program: Address::new_from_array(data[32..64].try_into().unwrap()),
            release_value: data[64],
            buyer_approved: data[65] != 0,
            seller_approved: data[66] != 0,
            disputed: data[67] != 0,
            dispute_pda: Address::new_from_array(data[68..100].try_into().unwrap()),
            offset: u16::from_le_bytes(data[100..102].try_into().unwrap()),
        })
    }
}

/// Outcome of a verdict read. `Resolve` branches on this.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum VerdictOutcome {
    ReleaseToBeneficiary,
    RefundDepositor,
    Pending,
}

impl SettlementData {
    /// Classify a raw verdict byte into a payout outcome.
    pub fn classify_verdict(&self, value: u8) -> VerdictOutcome {
        if value == self.release_value {
            VerdictOutcome::ReleaseToBeneficiary
        } else if value == VERDICT_PENDING {
            VerdictOutcome::Pending
        } else {
            VerdictOutcome::RefundDepositor
        }
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_settlement_new_config_zeroes_state() {
        let s = SettlementData::new_config(
            Address::new_from_array([1u8; 32]),
            Address::new_from_array([2u8; 32]),
            7,
        );
        assert!(!s.buyer_approved);
        assert!(!s.seller_approved);
        assert!(!s.disputed);
        assert_eq!(s.offset, 0);
        assert_eq!(s.dispute_pda, Address::default());
        assert_eq!(s.release_value, 7);
    }

    #[test]
    fn test_settlement_roundtrip() {
        let mut s = SettlementData::new_config(
            Address::new_from_array([1u8; 32]),
            Address::new_from_array([2u8; 32]),
            9,
        );
        s.buyer_approved = true;
        s.disputed = true;
        s.dispute_pda = Address::new_from_array([3u8; 32]);
        s.offset = 42;

        let bytes = s.to_bytes();
        assert_eq!(bytes.len(), SettlementData::LEN);
        let parsed = SettlementData::from_bytes(&bytes).unwrap();
        assert_eq!(parsed, s);
    }

    #[test]
    fn test_classify_verdict() {
        let s = SettlementData::new_config(Address::new_from_array([1u8; 32]), Address::new_from_array([2u8; 32]), 7);
        assert_eq!(s.classify_verdict(7), VerdictOutcome::ReleaseToBeneficiary);
        assert_eq!(s.classify_verdict(255), VerdictOutcome::Pending);
        assert_eq!(s.classify_verdict(0), VerdictOutcome::RefundDepositor);
        assert_eq!(s.classify_verdict(200), VerdictOutcome::RefundDepositor);
    }
}
