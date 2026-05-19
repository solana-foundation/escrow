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

interface AllowMintProps {
    hideKnownFields?: boolean;
    initialEscrow?: string;
    initialMint?: string;
    onSuccess?: () => void;
    submitLabel?: string;
}

export function AllowMint({
    hideKnownFields = false,
    initialEscrow = '',
    initialMint = '',
    onSuccess,
    submitLabel,
}: AllowMintProps = {}) {
    const { createSigner } = useWallet();
    const { send, sending, signature, error, reset } = useSendTx();
    const { defaultEscrow, defaultMint, rememberEscrow, rememberMint } = useSavedValues();
    const { programId } = useProgramContext();
    const [escrow, setEscrow] = useState(initialEscrow);
    const [mint, setMint] = useState(initialMint);
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
            onSuccess?.();
        }
    };

    return (
        <form
            onSubmit={e => {
                void handleSubmit(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
            {!hideKnownFields && (
                <>
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
                </>
            )}
            <SendButton sending={sending} label={submitLabel} />
            <TxResult signature={signature} error={formError ?? error} />
        </form>
    );
}
