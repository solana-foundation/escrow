//! End-to-end behaviour tests for two-party settlement:
//! - cooperative async approval → release to beneficiary
//! - dispute → verdict release_value → beneficiary
//! - dispute → refund byte → depositor
//! - dispute → pending (255) → DisputePending
//! - withdraw blocked while disputed
//!
//! Note: the escrow only checks `verdict_pda.owner() == dispute_program` (no CPI),
//! so tests inject a verdict account owned by `TEST_DISPUTE_PROGRAM` directly.

use escrow_program_client::instructions::{ApproveBuilder, RaiseDisputeBuilder, ResolveBuilder, SetSettlementBuilder, WithdrawBuilder};
use solana_address::Address;
use solana_sdk::{
    account::Account,
    instruction::InstructionError,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::TransactionError,
};

use crate::fixtures::{DepositSetup, DEFAULT_DEPOSIT_AMOUNT, TEST_DISPUTE_PROGRAM, TEST_RELEASE_VALUE};
use crate::utils::traits::TestInstruction;
use crate::utils::{find_extensions_pda, TestContext};

/// Custom error codes from `EscrowProgramError`.
const ERR_ESCROW_DISPUTED: u32 = 17;
const ERR_DISPUTE_PENDING: u32 = 18;
const ERR_INVALID_DISPUTE_PDA: u32 = 21;

#[allow(dead_code)]
struct Flow {
    escrow_pda: Pubkey,
    extensions_pda: Pubkey,
    extensions_bump: u8,
    admin: Keypair,
    mint: Keypair,
    token_program: Pubkey,
    vault: Pubkey,
    depositor: Keypair,
    depositor_token_account: Pubkey,
    receipt_seed: Keypair,
    receipt_pda: Pubkey,
    beneficiary: Keypair,
    beneficiary_token_account: Pubkey,
}

/// Build an escrow, allow a mint, deposit, and configure settlement.
fn setup_flow(ctx: &mut TestContext) -> Flow {
    let deposit = DepositSetup::new(ctx);

    // Execute the deposit (funds the vault, creates the receipt).
    let deposit_ix = deposit.build_instruction(ctx);
    deposit_ix.send_expect_success(ctx);

    let beneficiary = ctx.create_funded_keypair();
    let beneficiary_token_account = ctx.create_token_account(&beneficiary.pubkey(), &deposit.mint.pubkey());

    let (extensions_pda, extensions_bump) = find_extensions_pda(&deposit.escrow_pda);

    let set_settlement = SetSettlementBuilder::new()
        .payer(ctx.payer.pubkey())
        .admin(deposit.admin.pubkey())
        .escrow(deposit.escrow_pda)
        .extensions(extensions_pda)
        .extensions_bump(extensions_bump)
        .beneficiary(Address::from(beneficiary.pubkey().to_bytes()))
        .dispute_program(Address::from(TEST_DISPUTE_PROGRAM.to_bytes()))
        .release_value(TEST_RELEASE_VALUE)
        .instruction();
    ctx.send_transaction(set_settlement, &[&deposit.admin]).unwrap();

    Flow {
        escrow_pda: deposit.escrow_pda,
        extensions_pda,
        extensions_bump,
        admin: deposit.admin,
        mint: deposit.mint,
        token_program: deposit.token_program,
        vault: deposit.vault,
        depositor: deposit.depositor,
        depositor_token_account: deposit.depositor_token_account,
        receipt_seed: deposit.receipt_seed,
        receipt_pda: deposit.receipt_pda,
        beneficiary,
        beneficiary_token_account,
    }
}

/// Inject a verdict account owned by the configured dispute program with `value` at offset 0.
fn inject_verdict(ctx: &mut TestContext, value: u8) -> Pubkey {
    let addr = Pubkey::new_unique();
    let mut account = Account::new(1_000_000, 1, &TEST_DISPUTE_PROGRAM);
    account.data = vec![value];
    let _ = ctx.svm.set_account(addr, account);
    addr
}

fn approve(f: &Flow, approver: Keypair) -> TestInstruction {
    let instruction = ApproveBuilder::new()
        .approver(approver.pubkey())
        .rent_recipient(f.depositor.pubkey())
        .escrow(f.escrow_pda)
        .extensions(f.extensions_pda)
        .receipt(f.receipt_pda)
        .vault(f.vault)
        .beneficiary_token_account(f.beneficiary_token_account)
        .mint(f.mint.pubkey())
        .token_program(f.token_program)
        .instruction();
    TestInstruction { instruction, signers: vec![approver], name: "Approve" }
}

fn raise_dispute(f: &Flow, disputer: Keypair, verdict_pda: Pubkey, offset: u16) -> TestInstruction {
    let instruction = RaiseDisputeBuilder::new()
        .disputer(disputer.pubkey())
        .escrow(f.escrow_pda)
        .extensions(f.extensions_pda)
        .receipt(f.receipt_pda)
        .dispute_pda(verdict_pda)
        .offset(offset)
        .instruction();
    TestInstruction { instruction, signers: vec![disputer], name: "RaiseDispute" }
}

fn resolve(ctx: &mut TestContext, f: &Flow, verdict_pda: Pubkey) -> TestInstruction {
    let instruction = ResolveBuilder::new()
        .relayer(ctx.payer.pubkey())
        .rent_recipient(f.depositor.pubkey())
        .escrow(f.escrow_pda)
        .extensions(f.extensions_pda)
        .receipt(f.receipt_pda)
        .vault(f.vault)
        .depositor_token_account(f.depositor_token_account)
        .beneficiary_token_account(f.beneficiary_token_account)
        .dispute_pda(verdict_pda)
        .mint(f.mint.pubkey())
        .token_program(f.token_program)
        .instruction();
    TestInstruction { instruction, signers: vec![], name: "Resolve" }
}

fn assert_custom(err: TransactionError, code: u32) {
    match err {
        TransactionError::InstructionError(_, InstructionError::Custom(c)) => assert_eq!(c, code, "unexpected custom error code"),
        other => panic!("expected Custom({code}), got {other:?}"),
    }
}

// ============================================================================

#[test]
fn test_cooperative_release_on_second_approval() {
    let mut ctx = TestContext::new();
    let f = setup_flow(&mut ctx);

    // Buyer approves first — no release yet (seller has not approved).
    approve(&f, f.depositor.insecure_clone()).send_expect_success(&mut ctx);
    assert_eq!(ctx.get_token_balance(&f.vault), DEFAULT_DEPOSIT_AMOUNT);
    assert_eq!(ctx.get_token_balance(&f.beneficiary_token_account), 0);
    assert!(ctx.get_account(&f.receipt_pda).is_some());

    // Seller approves — second approval triggers release to beneficiary.
    approve(&f, f.beneficiary.insecure_clone()).send_expect_success(&mut ctx);

    assert_eq!(ctx.get_token_balance(&f.vault), 0);
    assert_eq!(ctx.get_token_balance(&f.beneficiary_token_account), DEFAULT_DEPOSIT_AMOUNT);
    assert!(ctx.get_account(&f.receipt_pda).is_none(), "receipt should be closed");
}

#[test]
fn test_dispute_verdict_releases_to_beneficiary() {
    let mut ctx = TestContext::new();
    let f = setup_flow(&mut ctx);

    let verdict = inject_verdict(&mut ctx, TEST_RELEASE_VALUE);
    raise_dispute(&f, f.depositor.insecure_clone(), verdict, 0).send_expect_success(&mut ctx);
    resolve(&mut ctx, &f, verdict).send_expect_success(&mut ctx);

    assert_eq!(ctx.get_token_balance(&f.vault), 0);
    assert_eq!(ctx.get_token_balance(&f.beneficiary_token_account), DEFAULT_DEPOSIT_AMOUNT);
    assert!(ctx.get_account(&f.receipt_pda).is_none());
}

#[test]
fn test_dispute_verdict_refunds_depositor() {
    let mut ctx = TestContext::new();
    let f = setup_flow(&mut ctx);

    // A non-release, non-pending byte means "refund buyer".
    let verdict = inject_verdict(&mut ctx, 0);
    raise_dispute(&f, f.beneficiary.insecure_clone(), verdict, 0).send_expect_success(&mut ctx);
    resolve(&mut ctx, &f, verdict).send_expect_success(&mut ctx);

    assert_eq!(ctx.get_token_balance(&f.vault), 0);
    // Depositor started with 10x; deposit moved 1x to vault; refund returns it.
    assert_eq!(ctx.get_token_balance(&f.depositor_token_account), DEFAULT_DEPOSIT_AMOUNT * 10);
    assert!(ctx.get_account(&f.receipt_pda).is_none());
}

#[test]
fn test_dispute_pending_verdict_errors() {
    let mut ctx = TestContext::new();
    let f = setup_flow(&mut ctx);

    let verdict = inject_verdict(&mut ctx, 255); // VERDICT_PENDING
    raise_dispute(&f, f.depositor.insecure_clone(), verdict, 0).send_expect_success(&mut ctx);

    let err = resolve(&mut ctx, &f, verdict).send_expect_error(&mut ctx);
    assert_custom(err, ERR_DISPUTE_PENDING);

    // Funds untouched while pending.
    assert_eq!(ctx.get_token_balance(&f.vault), DEFAULT_DEPOSIT_AMOUNT);
    assert!(ctx.get_account(&f.receipt_pda).is_some());
}

#[test]
fn test_withdraw_blocked_while_disputed() {
    let mut ctx = TestContext::new();
    let f = setup_flow(&mut ctx);

    let verdict = inject_verdict(&mut ctx, 255);
    raise_dispute(&f, f.depositor.insecure_clone(), verdict, 0).send_expect_success(&mut ctx);

    let withdraw = WithdrawBuilder::new()
        .rent_recipient(f.depositor.pubkey())
        .withdrawer(f.depositor.pubkey())
        .escrow(f.escrow_pda)
        .extensions(f.extensions_pda)
        .receipt(f.receipt_pda)
        .vault(f.vault)
        .withdrawer_token_account(f.depositor_token_account)
        .mint(f.mint.pubkey())
        .token_program(f.token_program)
        .instruction();
    let ti = TestInstruction { instruction: withdraw, signers: vec![f.depositor.insecure_clone()], name: "Withdraw" };

    let err = ti.send_expect_error(&mut ctx);
    assert_custom(err, ERR_ESCROW_DISPUTED);
}

#[test]
fn test_raise_dispute_rejects_wrong_owner_pda() {
    let mut ctx = TestContext::new();
    let f = setup_flow(&mut ctx);

    // Account owned by the system program (not TEST_DISPUTE_PROGRAM).
    let bogus = Pubkey::new_unique();
    let other_owner = Pubkey::new_unique();
    let mut bogus_account = Account::new(1_000_000, 1, &other_owner);
    bogus_account.data = vec![0u8];
    let _ = ctx.svm.set_account(bogus, bogus_account);

    let err = raise_dispute(&f, f.depositor.insecure_clone(), bogus, 0).send_expect_error(&mut ctx);
    assert_custom(err, ERR_INVALID_DISPUTE_PDA);
}
