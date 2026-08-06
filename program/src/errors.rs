use codama::CodamaErrors;
use pinocchio::error::ProgramError;
use thiserror::Error;

/// Errors that may be returned by the Escrow Program.
#[derive(Clone, Debug, Eq, PartialEq, Error, CodamaErrors)]
pub enum EscrowProgramError {
    /// (0) Escrow ID invalid or does not respect rules
    #[error("Escrow ID invalid or does not respect rules")]
    InvalidEscrowId,

    /// (1) Admin invalid or does not match escrow admin
    #[error("Admin invalid or does not match escrow admin")]
    InvalidAdmin,

    /// (2) Event authority PDA is invalid
    #[error("Event authority PDA is invalid")]
    InvalidEventAuthority,

    /// (3) Timelock has not expired yet
    #[error("Timelock has not expired yet")]
    TimelockNotExpired,

    /// (4) External hook rejected the operation
    #[error("External hook rejected the operation")]
    HookRejected,

    /// (5) Withdrawer does not match receipt depositor
    #[error("Withdrawer does not match receipt depositor")]
    InvalidWithdrawer,

    /// (6) Receipt escrow does not match escrow
    #[error("Receipt escrow does not match escrow")]
    InvalidReceiptEscrow,

    /// (7) Hook program mismatch
    #[error("Hook program mismatch")]
    HookProgramMismatch,

    /// (8) Mint is not allowed for this escrow
    #[error("Mint is not allowed for this escrow")]
    MintNotAllowed,

    /// (9) Mint has PermanentDelegate extension which is not allowed
    #[error("Mint has PermanentDelegate extension which is not allowed")]
    PermanentDelegateNotAllowed,

    /// (10) Mint has NonTransferable extension which is not allowed
    #[error("Mint has NonTransferable extension which is not allowed")]
    NonTransferableNotAllowed,

    /// (11) Mint has Pausable extension which is not allowed
    #[error("Mint has Pausable extension which is not allowed")]
    PausableNotAllowed,

    /// (12) Token extension already blocked
    #[error("Token extension already blocked")]
    TokenExtensionAlreadyBlocked,

    /// (13) Zero deposit amount
    #[error("Zero deposit amount")]
    ZeroDepositAmount,

    /// (14) Arbiter signer is missing or does not match
    #[error("Arbiter signer is missing or does not match")]
    InvalidArbiter,

    /// (15) Token extension is not currently blocked
    #[error("Token extension is not currently blocked")]
    TokenExtensionNotBlocked,

    /// (16) Escrow is immutable and cannot be modified
    #[error("Escrow is immutable and cannot be modified")]
    EscrowImmutable,
    /// (17) Escrow is disputed; cooperative/refund paths are frozen
    #[error("Escrow is disputed; only a verdict may move funds")]
    EscrowDisputed,
    /// (18) Dispute verdict is pending (byte == 255)
    #[error("Dispute verdict is still pending")]
    DisputePending,
    /// (19) A dispute is already raised (operation only valid pre-dispute)
    #[error("A dispute has already been raised")]
    AlreadyDisputed,
    /// (20) No dispute has been raised (Resolve only valid post-dispute)
    #[error("No dispute has been raised")]
    NotDisputed,
    /// (21) Dispute PDA is not owned by the configured dispute program
    #[error("Dispute PDA owner does not match the configured dispute program")]
    InvalidDisputePda,
    /// (22) Verdict offset is outside the dispute PDA data bounds
    #[error("Verdict offset is out of bounds")]
    VerdictOutOfBounds,
    /// (23) No Settlement extension is configured for this escrow
    #[error("No settlement is configured for this escrow")]
    SettlementNotConfigured,
    /// (24) Approver is neither the depositor nor the beneficiary
    #[error("Approver is neither the depositor nor the beneficiary")]
    InvalidApprover,
    /// (25) Configured release_value is reserved (must be != 255)
    #[error("release_value must not equal the pending sentinel (255)")]
    InvalidReleaseValue,
}

impl From<EscrowProgramError> for ProgramError {
    fn from(e: EscrowProgramError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_conversion() {
        let error: ProgramError = EscrowProgramError::InvalidEscrowId.into();
        assert_eq!(error, ProgramError::Custom(0));

        let error: ProgramError = EscrowProgramError::InvalidAdmin.into();
        assert_eq!(error, ProgramError::Custom(1));

        let error: ProgramError = EscrowProgramError::InvalidEventAuthority.into();
        assert_eq!(error, ProgramError::Custom(2));

        let error: ProgramError = EscrowProgramError::TimelockNotExpired.into();
        assert_eq!(error, ProgramError::Custom(3));

        let error: ProgramError = EscrowProgramError::HookRejected.into();
        assert_eq!(error, ProgramError::Custom(4));

        let error: ProgramError = EscrowProgramError::InvalidWithdrawer.into();
        assert_eq!(error, ProgramError::Custom(5));

        let error: ProgramError = EscrowProgramError::EscrowImmutable.into();
        assert_eq!(error, ProgramError::Custom(16));
        assert_eq!(error, ProgramError::Custom(16));
    }
}
