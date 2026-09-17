use crate::{
    fixtures::{
        AddBlockTokenExtensionsFixture, AddTimelockFixture, CreateEscrowFixture, SetHookFixture, SetImmutableFixture,
        UnblockTokenExtensionFixture,
    },
    utils::{
        assert_block_token_extensions_extension, assert_escrow_error, assert_extensions_header, assert_hook_extension,
        assert_instruction_error, assert_timelock_extension, find_escrow_pda, find_extensions_pda, test_empty_data,
        test_missing_signer, test_not_writable, test_truncated_data, test_wrong_account, test_wrong_current_program,
        test_wrong_system_program, EscrowError, InstructionTestFixture, TestContext, RANDOM_PUBKEY,
    },
};
use escrow_program_client::instructions::SetHookBuilder;
use solana_address::Address;
use solana_sdk::{instruction::InstructionError, pubkey::Pubkey, signature::Signer};

// ============================================================================
// Error Tests - Using Generic Test Helpers
// ============================================================================

#[test]
fn test_set_hook_missing_admin_signer() {
    let mut ctx = TestContext::new();
    test_missing_signer::<SetHookFixture>(&mut ctx, 1, 0);
}

#[test]
fn test_set_hook_extensions_not_writable() {
    let mut ctx = TestContext::new();
    test_not_writable::<SetHookFixture>(&mut ctx, 3);
}

#[test]
fn test_set_hook_wrong_system_program() {
    let mut ctx = TestContext::new();
    test_wrong_system_program::<SetHookFixture>(&mut ctx);
}

#[test]
fn test_set_hook_wrong_escrow_program() {
    let mut ctx = TestContext::new();
    test_wrong_current_program::<SetHookFixture>(&mut ctx);
}

#[test]
fn test_set_hook_invalid_event_authority() {
    let mut ctx = TestContext::new();
    test_wrong_account::<SetHookFixture>(&mut ctx, 5, InstructionError::Custom(2));
}

#[test]
fn test_set_hook_invalid_extensions_bump() {
    let mut ctx = TestContext::new();
    let test_ix = SetHookFixture::build_valid(&mut ctx);
    let correct_bump = test_ix.instruction.data[1];
    let invalid_bump = correct_bump.wrapping_add(1);
    let error = test_ix.with_data_byte_at(1, invalid_bump).send_expect_error(&mut ctx);
    assert_instruction_error(error, InstructionError::InvalidSeeds);
}

#[test]
fn test_set_hook_empty_data() {
    let mut ctx = TestContext::new();
    test_empty_data::<SetHookFixture>(&mut ctx);
}

#[test]
fn test_set_hook_truncated_data() {
    let mut ctx = TestContext::new();
    test_truncated_data::<SetHookFixture>(&mut ctx);
}

// ============================================================================
// Custom Error Tests
// ============================================================================

#[test]
fn test_set_hook_wrong_admin() {
    let mut ctx = TestContext::new();

    let escrow_ix = CreateEscrowFixture::build_valid(&mut ctx);
    let escrow_seed = escrow_ix.signers[1].pubkey();
    escrow_ix.send_expect_success(&mut ctx);

    let (escrow_pda, _) = find_escrow_pda(&escrow_seed);
    let wrong_admin = ctx.create_funded_keypair();
    let hook_program = Pubkey::new_unique();
    let test_ix = SetHookFixture::build_with_escrow(&mut ctx, escrow_pda, wrong_admin, hook_program);

    let error = test_ix.send_expect_error(&mut ctx);
    assert_instruction_error(error, InstructionError::Custom(1));
}

#[test]
fn test_set_hook_escrow_not_owned_by_program() {
    let mut ctx = TestContext::new();
    let test_ix = SetHookFixture::build_valid(&mut ctx);

    let error = test_ix.with_account_at(2, RANDOM_PUBKEY).send_expect_error(&mut ctx);
    assert_instruction_error(error, InstructionError::InvalidAccountOwner);
}

#[test]
fn test_set_hook_fails_when_escrow_is_immutable() {
    let mut ctx = TestContext::new();

    let escrow_ix = CreateEscrowFixture::build_valid(&mut ctx);
    let admin = escrow_ix.signers[0].insecure_clone();
    let escrow_seed = escrow_ix.signers[1].pubkey();
    escrow_ix.send_expect_success(&mut ctx);

    let (escrow_pda, _) = find_escrow_pda(&escrow_seed);
    let set_immutable_ix = SetImmutableFixture::build_with_escrow(&mut ctx, escrow_pda, admin.insecure_clone());
    set_immutable_ix.send_expect_success(&mut ctx);

    let hook_ix = SetHookFixture::build_with_escrow(&mut ctx, escrow_pda, admin, Pubkey::new_unique());
    let error = hook_ix.send_expect_error(&mut ctx);
    assert_escrow_error(error, EscrowError::EscrowImmutable);
}

#[test]
fn test_set_hook_updates_existing_extension() {
    let mut ctx = TestContext::new();

    let escrow_ix = CreateEscrowFixture::build_valid(&mut ctx);
    let admin = escrow_ix.signers[0].insecure_clone();
    let escrow_seed = escrow_ix.signers[1].pubkey();
    escrow_ix.send_expect_success(&mut ctx);

    let (escrow_pda, _) = find_escrow_pda(&escrow_seed);
    let (extensions_pda, extensions_bump) = find_extensions_pda(&escrow_pda);
    let first_hook_program = Pubkey::new_unique();

    let first_ix = SetHookFixture::build_with_escrow(&mut ctx, escrow_pda, admin.insecure_clone(), first_hook_program);
    first_ix.send_expect_success(&mut ctx);
    assert_extensions_header(&ctx, &extensions_pda, extensions_bump, 1);
    assert_hook_extension(&ctx, &extensions_pda, &first_hook_program);

    let second_hook_program = Pubkey::new_unique();
    let second_ix = SetHookFixture::build_with_escrow(&mut ctx, escrow_pda, admin, second_hook_program);
    second_ix.send_expect_success(&mut ctx);

    // Updating hook should replace value in place without increasing count.
    assert_extensions_header(&ctx, &extensions_pda, extensions_bump, 1);
    assert_hook_extension(&ctx, &extensions_pda, &second_hook_program);
}

// ============================================================================
// Success Tests
// ============================================================================

#[test]
fn test_set_hook_success() {
    let mut ctx = TestContext::new();
    let test_ix = SetHookFixture::build_valid(&mut ctx);

    let extensions_pda = test_ix.instruction.accounts[3].pubkey;
    let extensions_bump = test_ix.instruction.data[1];
    let hook_program = Pubkey::new_from_array(test_ix.instruction.data[2..34].try_into().unwrap());

    test_ix.send_expect_success(&mut ctx);

    assert_extensions_header(&ctx, &extensions_pda, extensions_bump, 1);
    assert_hook_extension(&ctx, &extensions_pda, &hook_program);
}

#[test]
fn test_set_hook_rejects_zero_hook_program() {
    let mut ctx = TestContext::new();

    let escrow_ix = CreateEscrowFixture::build_valid(&mut ctx);
    let admin = escrow_ix.signers[0].insecure_clone();
    let escrow_seed = escrow_ix.signers[1].pubkey();
    escrow_ix.send_expect_success(&mut ctx);

    let (escrow_pda, _) = find_escrow_pda(&escrow_seed);
    let (extensions_pda, extensions_bump) = find_extensions_pda(&escrow_pda);

    let hook_program = Pubkey::default();
    let instruction = SetHookBuilder::new()
        .payer(ctx.payer.pubkey())
        .admin(admin.pubkey())
        .escrow(escrow_pda)
        .extensions(extensions_pda)
        .extensions_bump(extensions_bump)
        .hook_program(Address::from(hook_program.to_bytes()))
        .instruction();

    let test_ix = crate::utils::TestInstruction { instruction, signers: vec![admin], name: "SetHook" };

    // A hook is always invoked once configured, so the zero address would brick
    // deposit and withdraw. RemoveExtension is the only disable path.
    let error = test_ix.send_expect_error(&mut ctx);
    assert_instruction_error(error, InstructionError::InvalidArgument);

    assert!(ctx.get_account(&extensions_pda).is_none(), "Extensions account should not be created");
}

// ============================================================================
// Combined Extension Tests
// ============================================================================

#[test]
fn test_add_timelock_then_set_hook() {
    let mut ctx = TestContext::new();

    let escrow_ix = CreateEscrowFixture::build_valid(&mut ctx);
    let admin = escrow_ix.signers[0].insecure_clone();
    let escrow_seed = escrow_ix.signers[1].pubkey();
    escrow_ix.send_expect_success(&mut ctx);

    let (escrow_pda, _) = find_escrow_pda(&escrow_seed);
    let (extensions_pda, extensions_bump) = find_extensions_pda(&escrow_pda);

    let timelock_ix = AddTimelockFixture::build_with_escrow(&mut ctx, escrow_pda, admin.insecure_clone(), 3600);
    timelock_ix.send_expect_success(&mut ctx);

    assert_extensions_header(&ctx, &extensions_pda, extensions_bump, 1);
    assert_timelock_extension(&ctx, &extensions_pda, 3600);

    let hook_program = Pubkey::new_unique();
    let hook_ix = SetHookFixture::build_with_escrow(&mut ctx, escrow_pda, admin, hook_program);
    hook_ix.send_expect_success(&mut ctx);

    assert_extensions_header(&ctx, &extensions_pda, extensions_bump, 2);
    assert_timelock_extension(&ctx, &extensions_pda, 3600);
    assert_hook_extension(&ctx, &extensions_pda, &hook_program);
}

#[test]
fn test_set_hook_then_add_timelock() {
    let mut ctx = TestContext::new();

    let escrow_ix = CreateEscrowFixture::build_valid(&mut ctx);
    let admin = escrow_ix.signers[0].insecure_clone();
    let escrow_seed = escrow_ix.signers[1].pubkey();
    escrow_ix.send_expect_success(&mut ctx);

    let (escrow_pda, _) = find_escrow_pda(&escrow_seed);
    let (extensions_pda, extensions_bump) = find_extensions_pda(&escrow_pda);

    let hook_program = Pubkey::new_unique();
    let hook_ix = SetHookFixture::build_with_escrow(&mut ctx, escrow_pda, admin.insecure_clone(), hook_program);
    hook_ix.send_expect_success(&mut ctx);

    assert_extensions_header(&ctx, &extensions_pda, extensions_bump, 1);
    assert_hook_extension(&ctx, &extensions_pda, &hook_program);

    let timelock_ix = AddTimelockFixture::build_with_escrow(&mut ctx, escrow_pda, admin, 7200);
    timelock_ix.send_expect_success(&mut ctx);

    assert_extensions_header(&ctx, &extensions_pda, extensions_bump, 2);
    assert_hook_extension(&ctx, &extensions_pda, &hook_program);
    assert_timelock_extension(&ctx, &extensions_pda, 7200);
}

#[test]
fn test_set_hook_after_blocked_extension_shrink_keeps_tlv_parseable() {
    let mut ctx = TestContext::new();

    let escrow_ix = CreateEscrowFixture::build_valid(&mut ctx);
    let admin = escrow_ix.signers[0].insecure_clone();
    let escrow_seed = escrow_ix.signers[1].pubkey();
    escrow_ix.send_expect_success(&mut ctx);

    let (escrow_pda, _) = find_escrow_pda(&escrow_seed);
    let (extensions_pda, extensions_bump) = find_extensions_pda(&escrow_pda);

    AddBlockTokenExtensionsFixture::build_with_escrow(&mut ctx, escrow_pda, admin.insecure_clone(), 1u16)
        .send_expect_success(&mut ctx);
    AddBlockTokenExtensionsFixture::build_with_escrow(&mut ctx, escrow_pda, admin.insecure_clone(), 2u16)
        .send_expect_success(&mut ctx);
    assert_extensions_header(&ctx, &extensions_pda, extensions_bump, 1);
    assert_block_token_extensions_extension(&ctx, &extensions_pda, &[1u16, 2u16]);

    // This path calls update_extension with smaller data (2 entries -> 1 entry).
    UnblockTokenExtensionFixture::build_with_escrow(&mut ctx, escrow_pda, admin.insecure_clone(), 1u16)
        .send_expect_success(&mut ctx);
    assert_extensions_header(&ctx, &extensions_pda, extensions_bump, 1);
    assert_block_token_extensions_extension(&ctx, &extensions_pda, &[2u16]);

    // Use deterministic bytes so stale-data parsing bugs are reproducible.
    let hook_program = Pubkey::new_from_array([0xAA; 32]);
    let hook_ix = SetHookFixture::build_with_escrow(&mut ctx, escrow_pda, admin, hook_program);
    hook_ix.send_expect_success(&mut ctx);

    assert_extensions_header(&ctx, &extensions_pda, extensions_bump, 2);
    assert_block_token_extensions_extension(&ctx, &extensions_pda, &[2u16]);
    assert_hook_extension(&ctx, &extensions_pda, &hook_program);
}

#[test]
fn test_multiple_extensions_extension_count() {
    let mut ctx = TestContext::new();

    let escrow_ix = CreateEscrowFixture::build_valid(&mut ctx);
    let admin = escrow_ix.signers[0].insecure_clone();
    let escrow_seed = escrow_ix.signers[1].pubkey();
    escrow_ix.send_expect_success(&mut ctx);

    let (escrow_pda, _) = find_escrow_pda(&escrow_seed);
    let (extensions_pda, extensions_bump) = find_extensions_pda(&escrow_pda);

    let timelock_ix = AddTimelockFixture::build_with_escrow(&mut ctx, escrow_pda, admin.insecure_clone(), 1000);
    timelock_ix.send_expect_success(&mut ctx);
    assert_extensions_header(&ctx, &extensions_pda, extensions_bump, 1);

    let hook_program = Pubkey::new_unique();
    let hook_ix = SetHookFixture::build_with_escrow(&mut ctx, escrow_pda, admin, hook_program);
    hook_ix.send_expect_success(&mut ctx);
    assert_extensions_header(&ctx, &extensions_pda, extensions_bump, 2);
}
