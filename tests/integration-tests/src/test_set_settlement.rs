use crate::fixtures::SetSettlementFixture;
use crate::utils::test_helpers::*;
use crate::utils::traits::InstructionTestFixture;
use crate::utils::TestContext;

// ============================================================================
// Generic error tests (driven by the InstructionTestFixture trait)
// ============================================================================

#[test]
fn test_set_settlement_missing_admin_signer() {
    let mut ctx = TestContext::new();
    test_missing_signer::<SetSettlementFixture>(&mut ctx, 1, 0);
}

#[test]
fn test_set_settlement_extensions_not_writable() {
    let mut ctx = TestContext::new();
    test_not_writable::<SetSettlementFixture>(&mut ctx, 3);
}

#[test]
fn test_set_settlement_wrong_system_program() {
    let mut ctx = TestContext::new();
    test_wrong_system_program::<SetSettlementFixture>(&mut ctx);
}

#[test]
fn test_set_settlement_wrong_escrow_program() {
    let mut ctx = TestContext::new();
    test_wrong_current_program::<SetSettlementFixture>(&mut ctx);
}

#[test]
fn test_set_settlement_empty_data() {
    let mut ctx = TestContext::new();
    test_empty_data::<SetSettlementFixture>(&mut ctx);
}

#[test]
fn test_set_settlement_truncated_data() {
    let mut ctx = TestContext::new();
    test_truncated_data::<SetSettlementFixture>(&mut ctx);
}

#[test]
fn test_set_settlement_invalid_extensions_bump() {
    let mut ctx = TestContext::new();
    // bump byte sits at data index 1 (index 0 is the discriminator)
    test_invalid_bump::<SetSettlementFixture>(&mut ctx, 1, 0);
}

// ============================================================================
// Custom error tests
// ============================================================================

#[test]
fn test_set_settlement_wrong_admin() {
    let mut ctx = TestContext::new();
    // Escrow is created with the real admin...
    let escrow_ix = crate::fixtures::CreateEscrowFixture::build_valid(&mut ctx);
    let _real_admin = escrow_ix.signers[0].insecure_clone();
    let escrow_seed = escrow_ix.signers[1].pubkey();
    escrow_ix.send_expect_success(&mut ctx);
    let (escrow_pda, _) = crate::utils::find_escrow_pda(&escrow_seed);

    // ...but SetSettlement is signed by a different keypair -> InvalidAdmin (1).
    let wrong_admin = ctx.create_funded_keypair();
    let ix = SetSettlementFixture::build_with_escrow(
        &mut ctx,
        escrow_pda,
        wrong_admin.insecure_clone(),
        Keypair::new().pubkey(),
        crate::fixtures::TEST_DISPUTE_PROGRAM,
        crate::fixtures::TEST_RELEASE_VALUE,
    );
    let err = ix.send_expect_error(&mut ctx);
    assert!(matches!(
        err,
        solana_sdk::transaction::TransactionError::InstructionError(_, solana_sdk::instruction::InstructionError::Custom(1))
    ));
}

#[test]
fn test_set_settlement_rejects_pending_release_value() {
    // release_value == 255 is reserved (VERDICT_PENDING) and must be rejected.
    let mut ctx = TestContext::new();
    let escrow_ix = crate::fixtures::CreateEscrowFixture::build_valid(&mut ctx);
    let admin = escrow_ix.signers[0].insecure_clone();
    let escrow_seed = escrow_ix.signers[1].pubkey();
    escrow_ix.send_expect_success(&mut ctx);

    let (escrow_pda, _) = crate::utils::find_escrow_pda(&escrow_seed);

    let ix = SetSettlementFixture::build_with_escrow(
        &mut ctx,
        escrow_pda,
        admin.insecure_clone(),
        Keypair::new().pubkey(),
        crate::fixtures::TEST_DISPUTE_PROGRAM,
        255, // invalid
    );
    let err = ix.send_expect_error(&mut ctx);
    assert!(matches!(
        err,
        solana_sdk::transaction::TransactionError::InstructionError(_, solana_sdk::instruction::InstructionError::Custom(25)) // InvalidReleaseValue
    ));
}

// ============================================================================
// Success
// ============================================================================

#[test]
fn test_set_settlement_success() {
    let mut ctx = TestContext::new();
    let ix = SetSettlementFixture::build_valid(&mut ctx);
    let cu = ix.send_expect_success(&mut ctx);
    assert!(cu > 0);
}

use solana_sdk::signature::{Keypair, Signer};
