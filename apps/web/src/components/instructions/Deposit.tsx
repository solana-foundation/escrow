'use client';

import { useState } from 'react';
import { generateKeyPairSigner, type Address } from '@solana/kit';
import { findReceiptPda, getDepositInstructionAsync } from '@solana/escrow-program-client';
import { useSendTx } from '@/hooks/useSendTx';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useProgramContext } from '@/contexts/ProgramContext';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress, validatePositiveInteger } from '@/lib/validation';
import { FormField, SendButton } from './shared';

export function Deposit() {
    const { createSigner } = useWallet();
    const { send, sending, signature, error, reset } = useSendTx();
    const { defaultEscrow, defaultMint, rememberEscrow, rememberMint, rememberReceipt } = useSavedValues();
    const { programId } = useProgramContext();
    const [escrow, setEscrow] = useState('');
    const [mint, setMint] = useState('');
    const [amount, setAmount] = useState('');
    const [generatedSeed, setGeneratedSeed] = useState('');
    const [generatedReceipt, setGeneratedReceipt] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        reset();
        setFormError(null);
        const signer = createSigner();
        if (!signer) return;

        const validationError = firstValidationError(
            validateAddress(escrow, 'Escrow address'),
            validateAddress(mint, 'Mint address'),
            validatePositiveInteger(amount, 'Amount'),
        );
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const receiptSeed = await generateKeyPairSigner();
        setGeneratedSeed(receiptSeed.address);
        const signerAddress = signer.address as Address;
        const [receipt] = await findReceiptPda(
            {
                escrow: escrow as Address,
                depositor: signerAddress,
                mint: mint as Address,
                receiptSeed: receiptSeed.address,
            },
            { programAddress: programId as Address },
        );
        setGeneratedReceipt(receipt);

        const ix = await getDepositInstructionAsync(
            {
                depositor: signer,
                escrow: escrow as Address,
                mint: mint as Address,
                amount: BigInt(amount),
                receiptSeed,
                payer: signer,
            },
            { programAddress: programId as Address },
        );
        const txSignature = await send([ix], {
            action: 'Deposit',
            values: { escrow, mint, receipt, amount },
        });
        if (txSignature) {
            rememberEscrow(escrow);
            rememberMint(mint);
            rememberReceipt(receipt);
        }
    };

    return (
        <form
            onSubmit={e => {
                void handleSubmit(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
            <FormField
                label="Escrow Address"
                value={escrow}
                onChange={setEscrow}
                autoFillValue={defaultEscrow}
                onAutoFill={setEscrow}
                placeholder="Escrow PDA address"
                required
            />
            <FormField
                label="Mint Address"
                value={mint}
                onChange={setMint}
                autoFillValue={defaultMint}
                onAutoFill={setMint}
                placeholder="SPL token mint address"
                required
            />
            <FormField
                label="Amount (in base units)"
                value={amount}
                onChange={setAmount}
                placeholder="e.g. 1000000 for 1 token with 6 decimals"
                type="number"
                hint="Amount in smallest token units (no decimals)"
                required
            />
            {generatedSeed && (
                <FormField
                    label="Generated Receipt Seed"
                    value={generatedSeed}
                    onChange={() => {}}
                    readOnly
                    hint="Random seed used to derive the receipt PDA"
                />
            )}
            {generatedReceipt && (
                <FormField
                    label="Generated Receipt PDA"
                    value={generatedReceipt}
                    onChange={() => {}}
                    readOnly
                    hint="Saved as the default receipt when deposit succeeds"
                />
            )}
            <SendButton sending={sending} />
            <TxResult signature={signature} error={formError ?? error} />
        </form>
    );
}
