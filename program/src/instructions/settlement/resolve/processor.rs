use pinocchio::{account::AccountView, error::ProgramError, Address, ProgramResult};
use pinocchio_token_2022::instructions::TransferChecked;

use crate::{
    errors::EscrowProgramError,
    events::ReleaseEvent,
    instructions::Resolve,
    state::{get_extensions_from_account, validate_extensions_pda, Escrow, ExtensionType, Receipt, SettlementData, VerdictOutcome},
    traits::{AccountDeserialize, EventSerialize, ExtensionData},
    utils::{close_pda_account, emit_event, get_mint_decimals, validate_associated_token_account, verify_owned_by},
};

/// Processes the Resolve instruction.
///
/// Permissionless: anyone may submit. Reads the verdict byte from the dispute PDA
/// pinned at `RaiseDispute` and pays out to the winner, then closes the receipt.
///
/// Verdict tri-state:
/// - `== release_value` → pay beneficiary (seller)
/// - `== 255` (pending) → `DisputePending`
/// - anything else      → pay depositor (buyer)
pub fn process_resolve(program_id: &Address, accounts: &[AccountView], instruction_data: &[u8]) -> ProgramResult {
    let ix = Resolve::try_from((instruction_data, accounts))?;

    // Validate escrow
    {
        let escrow_data = ix.accounts.escrow.try_borrow()?;
        let _escrow = Escrow::from_account(&escrow_data, ix.accounts.escrow, program_id)?;
    }

    // Validate extensions PDA
    validate_extensions_pda(ix.accounts.escrow, ix.accounts.extensions, program_id)?;

    // Read receipt context
    let (depositor, receipt_mint, amount) = {
        let receipt_data = ix.accounts.receipt.try_borrow()?;
        let receipt = Receipt::from_account(&receipt_data, ix.accounts.receipt, program_id)?;
        if receipt.escrow != *ix.accounts.escrow.address() {
            return Err(EscrowProgramError::InvalidReceiptEscrow.into());
        }
        if receipt.mint != *ix.accounts.mint.address() {
            return Err(ProgramError::InvalidAccountData);
        }
        (receipt.depositor, receipt.mint, receipt.amount)
    };

    // Load settlement; Resolve is only valid post-dispute.
    let settlement = {
        let exts = get_extensions_from_account(ix.accounts.extensions, &[ExtensionType::Settlement])?;
        let bytes = exts[0].as_ref().ok_or(EscrowProgramError::SettlementNotConfigured)?;
        SettlementData::from_bytes(bytes)?
    };
    if !settlement.disputed {
        return Err(EscrowProgramError::NotDisputed.into());
    }

    // Anti-swap + ownership (defense-in-depth): the passed dispute PDA must be exactly the
    // pinned address and still owned by the configured dispute program.
    if ix.accounts.dispute_pda.address() != &settlement.dispute_pda {
        return Err(EscrowProgramError::InvalidDisputePda.into());
    }
    verify_owned_by(ix.accounts.dispute_pda, &settlement.dispute_program)
        .map_err(|_| EscrowProgramError::InvalidDisputePda)?;

    // Read + classify the verdict (offset bounds-checked inside read_verdict).
    let verdict = settlement.read_verdict(ix.accounts.dispute_pda)?;
    let (dest, recipient) = match settlement.classify_verdict(verdict) {
        VerdictOutcome::ReleaseToBeneficiary => {
            validate_associated_token_account(
                ix.accounts.beneficiary_token_account,
                &settlement.beneficiary,
                ix.accounts.mint,
                ix.accounts.token_program,
            )?;
            (ix.accounts.beneficiary_token_account, settlement.beneficiary)
        }
        VerdictOutcome::Pending => return Err(EscrowProgramError::DisputePending.into()),
        VerdictOutcome::RefundDepositor => {
            validate_associated_token_account(
                ix.accounts.depositor_token_account,
                &depositor,
                ix.accounts.mint,
                ix.accounts.token_program,
            )?;
            (ix.accounts.depositor_token_account, depositor)
        }
    };

    // Vault must be the escrow's ATA.
    validate_associated_token_account(ix.accounts.vault, ix.accounts.escrow.address(), ix.accounts.mint, ix.accounts.token_program)?;

    let decimals = get_mint_decimals(ix.accounts.mint)?;

    {
        let escrow_data = ix.accounts.escrow.try_borrow()?;
        let escrow = Escrow::from_bytes(&escrow_data)?;
        escrow.with_signer(|signers| {
            TransferChecked {
                from: ix.accounts.vault,
                mint: ix.accounts.mint,
                to: dest,
                authority: ix.accounts.escrow,
                amount,
                decimals,
                token_program: ix.accounts.token_program.address(),
            }
            .invoke_signed(signers)
        })?;
    }

    close_pda_account(ix.accounts.receipt, ix.accounts.rent_recipient)?;

    let event = ReleaseEvent::new(*ix.accounts.escrow.address(), recipient, receipt_mint, amount);
    emit_event(program_id, ix.accounts.event_authority, ix.accounts.escrow_program, &event.to_bytes())?;

    Ok(())
}
