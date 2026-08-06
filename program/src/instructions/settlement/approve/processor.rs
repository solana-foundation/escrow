use pinocchio::{account::AccountView, error::ProgramError, Address, ProgramResult};
use pinocchio_token_2022::instructions::TransferChecked;

use crate::{
    errors::EscrowProgramError,
    events::ReleaseEvent,
    instructions::Approve,
    state::{
        get_extensions_from_account, update_extension, validate_extensions_pda, Escrow, ExtensionType, Receipt, SettlementData,
    },
    traits::{AccountDeserialize, EventSerialize, ExtensionData},
    utils::{close_pda_account, emit_event, get_mint_decimals, validate_associated_token_account},
};

/// Processes the Approve instruction.
///
/// Records an async cooperative approval from the depositor (buyer) or the
/// beneficiary (seller). On the second approval — if the escrow is not disputed —
/// the funds release to the beneficiary and the receipt is closed.
pub fn process_approve(program_id: &Address, accounts: &[AccountView], instruction_data: &[u8]) -> ProgramResult {
    let ix = Approve::try_from((instruction_data, accounts))?;

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

    // Load settlement
    let mut settlement = {
        let exts = get_extensions_from_account(ix.accounts.extensions, &[ExtensionType::Settlement])?;
        let bytes = exts[0].as_ref().ok_or(EscrowProgramError::SettlementNotConfigured)?;
        SettlementData::from_bytes(bytes)?
    };

    // Cooperative approval is only valid pre-dispute.
    if settlement.disputed {
        return Err(EscrowProgramError::AlreadyDisputed.into());
    }

    // Identify which party is approving.
    let approver = ix.accounts.approver.address();
    if approver == &depositor {
        settlement.buyer_approved = true;
    } else if approver == &settlement.beneficiary {
        settlement.seller_approved = true;
    } else {
        return Err(EscrowProgramError::InvalidApprover.into());
    }

    // Persist the flag (same-size in-place rewrite; no rent needed).
    let updated_bytes = settlement.to_bytes();
    update_extension(ix.accounts.approver, ix.accounts.extensions, ExtensionType::Settlement, &updated_bytes)?;

    // Cooperative release once both have approved.
    if settlement.buyer_approved && settlement.seller_approved {
        // Vault must be the escrow's ATA; destination must be the beneficiary's ATA.
        validate_associated_token_account(ix.accounts.vault, ix.accounts.escrow.address(), ix.accounts.mint, ix.accounts.token_program)?;
        validate_associated_token_account(
            ix.accounts.beneficiary_token_account,
            &settlement.beneficiary,
            ix.accounts.mint,
            ix.accounts.token_program,
        )?;

        let decimals = get_mint_decimals(ix.accounts.mint)?;

        {
            let escrow_data = ix.accounts.escrow.try_borrow()?;
            let escrow = Escrow::from_bytes(&escrow_data)?;
            escrow.with_signer(|signers| {
                TransferChecked {
                    from: ix.accounts.vault,
                    mint: ix.accounts.mint,
                    to: ix.accounts.beneficiary_token_account,
                    authority: ix.accounts.escrow,
                    amount,
                    decimals,
                    token_program: ix.accounts.token_program.address(),
                }
                .invoke_signed(signers)
            })?;
        }

        close_pda_account(ix.accounts.receipt, ix.accounts.rent_recipient)?;

        let event = ReleaseEvent::new(*ix.accounts.escrow.address(), settlement.beneficiary, receipt_mint, amount);
        emit_event(program_id, ix.accounts.event_authority, ix.accounts.escrow_program, &event.to_bytes())?;
    }

    Ok(())
}
