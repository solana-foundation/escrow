'use client';

import { useState } from 'react';
import type { Address } from '@solana/kit';
import { getAllowMintInstructionAsync } from '@solana/escrow';
import { useSendTx } from '@/hooks/useSendTx';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useProgramContext } from '@/contexts/ProgramContext';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress } from '@/lib/validation';
import { FormField, SendButton } from './shared';

export function AllowMint() {
    const { createSigner } = useWallet();
    const { send, sending, signature, error, reset } = useSendTx();
    const { defaultEscrow, defaultMint, rememberEscrow, rememberMint } = useSavedValues();
    const { programId } = useProgramContext();
    const [escrow, setEscrow] = useState('');
    const [mint, setMint] = useState('');
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
        );
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const ix = await getAllowMintInstructionAsync(
            {
                admin: signer,
                escrow: escrow as Address,
                mint: mint as Address,
                payer: signer,
            },
            { programAddress: programId as Address },
        );
        const txSignature = await send([ix], {
            action: 'Allow Mint',
            values: { escrow, mint },
        });
        if (txSignature) {
            rememberEscrow(escrow);
            rememberMint(mint);
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
                placeholder="SPL token mint to allow"
                required
            />
            <SendButton sending={sending} />
            <TxResult signature={signature} error={formError ?? error} />
        </form>
    );
}
