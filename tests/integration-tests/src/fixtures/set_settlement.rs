use escrow_program_client::instructions::SetSettlementBuilder;
use solana_sdk::{
    pubkey::Pubkey,
    signature::{Keypair, Signer},
};

use crate::{
    fixtures::CreateEscrowFixture,
    utils::{find_escrow_pda, find_extensions_pda, TestContext},
};

use crate::utils::traits::{InstructionTestFixture, TestInstruction};

/// A throwaway pubkey used as the configured `dispute_program` in unit-style tests.
/// The escrow never CPIs it — it only checks `verdict_pda.owner() == dispute_program` —
/// so it need not be an executable program.
pub const TEST_DISPUTE_PROGRAM: Pubkey = Pubkey::from_str_const("EpkG1ek8zrHWHqgUv42fTd6vJPsceSzkPSZfGaoLUGqf");

/// Verdict byte meaning "pay the seller" used in tests. Anything != 255 and != this refunds the buyer.
pub const TEST_RELEASE_VALUE: u8 = 1;

pub struct SetSettlementFixture;

impl SetSettlementFixture {
    pub fn build_with_escrow(
        ctx: &mut TestContext,
        escrow_pda: Pubkey,
        admin: Keypair,
        beneficiary: Pubkey,
        dispute_program: Pubkey,
        release_value: u8,
    ) -> TestInstruction {
        let (extensions_pda, extensions_bump) = find_extensions_pda(&escrow_pda);

        let instruction = SetSettlementBuilder::new()
            .payer(ctx.payer.pubkey())
            .admin(admin.pubkey())
            .escrow(escrow_pda)
            .extensions(extensions_pda)
            .extensions_bump(extensions_bump)
            .beneficiary(solana_address::Address::from(beneficiary.to_bytes()))
            .dispute_program(solana_address::Address::from(dispute_program.to_bytes()))
            .release_value(release_value)
            .instruction();

        TestInstruction { instruction, signers: vec![admin], name: Self::INSTRUCTION_NAME }
    }
}

impl InstructionTestFixture for SetSettlementFixture {
    const INSTRUCTION_NAME: &'static str = "SetSettlement";

    fn build_valid(ctx: &mut TestContext) -> TestInstruction {
        let escrow_ix = CreateEscrowFixture::build_valid(ctx);
        let admin = escrow_ix.signers[0].insecure_clone();
        let escrow_seed = escrow_ix.signers[1].pubkey();
        escrow_ix.send_expect_success(ctx);

        let (escrow_pda, _) = find_escrow_pda(&escrow_seed);
        let (extensions_pda, extensions_bump) = find_extensions_pda(&escrow_pda);

        let beneficiary = Keypair::new().pubkey();

        let instruction = SetSettlementBuilder::new()
            .payer(ctx.payer.pubkey())
            .admin(admin.pubkey())
            .escrow(escrow_pda)
            .extensions(extensions_pda)
            .extensions_bump(extensions_bump)
            .beneficiary(solana_address::Address::from(beneficiary.to_bytes()))
            .dispute_program(solana_address::Address::from(TEST_DISPUTE_PROGRAM.to_bytes()))
            .release_value(TEST_RELEASE_VALUE)
            .instruction();

        TestInstruction { instruction, signers: vec![admin], name: Self::INSTRUCTION_NAME }
    }

    /// Account indices that must be signers: 1: admin (payer at 0 is handled by TestContext).
    fn required_signers() -> &'static [usize] {
        &[1]
    }

    /// Account indices that must be writable: 3: extensions.
    fn required_writable() -> &'static [usize] {
        &[3]
    }

    fn system_program_index() -> Option<usize> {
        Some(4)
    }

    fn current_program_index() -> Option<usize> {
        Some(6)
    }

    /// discriminator(1) + extensions_bump(1) + beneficiary(32) + dispute_program(32) + release_value(1)
    fn data_len() -> usize {
        67
    }
}
