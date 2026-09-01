use pinocchio::{account::AccountView, Address, ProgramResult};

use crate::{
    errors::EscrowProgramError,
    events::DisputeRaisedEvent,
    instructions::RaiseDispute,
    state::{
        get_extensions_from_account, update_extension, validate_extensions_pda, Escrow, ExtensionType, Receipt, SettlementData,
    },
    traits::{EventSerialize, ExtensionData},
    utils::{emit_event, verify_owned_by},
};

/// Processes the RaiseDispute instruction.
///
/// Locks the escrow: from this point the cooperative path and the buyer's
/// timelock refund are both frozen (see the `Withdraw` disputed-gate), and the
/// only exit is `Resolve` reading the verdict from the pinned dispute PDA.
///
/// The disputer supplies the dispute PDA and the verdict byte offset; the escrow
/// pins them verbatim but requires the PDA to be owned by the configured
/// `dispute_program` (the sole trust check). Binding the verdict PDA to this
/// escrow is the dispute program's responsibility (see DISPUTS.md §9).
pub fn process_raise_dispute(program_id: &Address, accounts: &[AccountView], instruction_data: &[u8]) -> ProgramResult {
    let ix = RaiseDispute::try_from((instruction_data, accounts))?;

    // Validate escrow
    {
        let escrow_data = ix.accounts.escrow.try_borrow()?;
        let _escrow = Escrow::from_account(&escrow_data, ix.accounts.escrow, program_id)?;
    }

    // Validate extensions PDA
    validate_extensions_pda(ix.accounts.escrow, ix.accounts.extensions, program_id)?;

    // Read receipt depositor (auth source)
    let depositor = {
        let receipt_data = ix.accounts.receipt.try_borrow()?;
        let receipt = Receipt::from_account(&receipt_data, ix.accounts.receipt, program_id)?;
        if receipt.escrow != *ix.accounts.escrow.address() {
            return Err(EscrowProgramError::InvalidReceiptEscrow.into());
        }
        receipt.depositor
    };

    // Load settlement
    let mut settlement = {
        let exts = get_extensions_from_account(ix.accounts.extensions, &[ExtensionType::Settlement])?;
        let bytes = exts[0].as_ref().ok_or(EscrowProgramError::SettlementNotConfigured)?;
        SettlementData::from_bytes(bytes)?
    };

    // One-way lock.
    if settlement.disputed {
        return Err(EscrowProgramError::AlreadyDisputed.into());
    }

    // Auth: only a party to the trade may raise.
    let disputer = ix.accounts.disputer.address();
    if disputer != &depositor && disputer != &settlement.beneficiary {
        return Err(EscrowProgramError::InvalidApprover.into());
    }

    // Ownership pin: the dispute PDA must be owned by the configured dispute program.
    verify_owned_by(ix.accounts.dispute_pda, &settlement.dispute_program)
        .map_err(|_| EscrowProgramError::InvalidDisputePda)?;

    // Bounds pre-check against the supplied offset.
    if usize::from(ix.data.offset) >= ix.accounts.dispute_pda.data_len() {
        return Err(EscrowProgramError::VerdictOutOfBounds.into());
    }

    // Pin the verdict source and flip the lock.
    settlement.disputed = true;
    settlement.dispute_pda = *ix.accounts.dispute_pda.address();
    settlement.offset = ix.data.offset;

    let updated_bytes = settlement.to_bytes();
    update_extension(ix.accounts.disputer, ix.accounts.extensions, ExtensionType::Settlement, &updated_bytes)?;

    // Emit event
    let event = DisputeRaisedEvent::new(*ix.accounts.escrow.address(), settlement.dispute_pda, settlement.offset);
    emit_event(program_id, ix.accounts.event_authority, ix.accounts.escrow_program, &event.to_bytes())?;

    Ok(())
}
