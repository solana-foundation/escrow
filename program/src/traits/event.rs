use alloc::vec::Vec;

use crate::events::EVENT_IX_TAG_LE;

/// Length of event discriminator bytes (EVENT_IX_TAG_LE + discriminator byte)
pub const EVENT_DISCRIMINATOR_LEN: usize = 8 + 1;

/// Event discriminator values for this program
#[repr(u8)]
pub enum EventDiscriminators {
    CreatesEscrow = 0,
    TimelockAdded = 1,
    HookSet = 2,
    Deposit = 3,
    AdminUpdate = 4,
    Withdraw = 5,
    AllowMint = 6,
    BlockMint = 7,
    TokenExtensionBlocked = 8,
    ArbiterSet = 9,
    ExtensionRemoved = 10,
    TokenExtensionUnblocked = 11,
    SetImmutable = 12,
    SettlementConfigured = 13,
    DisputeRaised = 14,
    Release = 15,
}

/// Event discriminator with Anchor-compatible prefix
pub trait EventDiscriminator {
    /// Event discriminator byte
    const DISCRIMINATOR: u8;

    /// Full discriminator bytes including EVENT_IX_TAG_LE prefix
    #[inline(always)]
    fn discriminator_bytes() -> Vec<u8> {
        let mut data = Vec::with_capacity(EVENT_DISCRIMINATOR_LEN);
        data.extend_from_slice(EVENT_IX_TAG_LE);
        data.push(Self::DISCRIMINATOR);
        data
    }
}

/// Event serialization
pub trait EventSerialize: EventDiscriminator {
    /// Serialize event data (without discriminator)
    fn to_bytes_inner(&self) -> Vec<u8>;

    /// Serialize with full discriminator prefix
    #[inline(always)]
    fn to_bytes(&self) -> Vec<u8> {
        let mut data = Self::discriminator_bytes();
        data.extend_from_slice(&self.to_bytes_inner());
        data
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestEvent;

    impl EventDiscriminator for TestEvent {
        const DISCRIMINATOR: u8 = 42;
    }

    #[test]
    fn test_discriminator_bytes_length() {
        let bytes = TestEvent::discriminator_bytes();
        assert_eq!(bytes.len(), EVENT_DISCRIMINATOR_LEN);
    }

    #[test]
    fn test_discriminator_bytes_prefix() {
        let bytes = TestEvent::discriminator_bytes();
        assert_eq!(&bytes[..8], EVENT_IX_TAG_LE);
        assert_eq!(bytes[8], 42);
    }
}
