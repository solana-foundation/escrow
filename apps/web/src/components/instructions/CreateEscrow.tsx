'use client';

import { useState } from 'react';
import { generateKeyPairSigner, type Address } from '@solana/kit';
import { findEscrowPda, getCreatesEscrowInstructionAsync } from '@solana/escrow';
import { useSendTx } from '@/hooks/useSendTx';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useProgramContext } from '@/contexts/ProgramContext';
import { TxResult } from '@/components/TxResult';
import { FormField, SendButton } from './shared';

interface CreateEscrowProps {
    onSuccess?: () => void;
    submitLabel?: string;
}

export function CreateEscrow({ onSuccess, submitLabel }: CreateEscrowProps = {}) {
    const { account, createSigner } = useWallet();
    const { send, sending, signature, error, reset } = useSendTx();
    const { rememberEscrow } = useSavedValues();
    const { programId } = useProgramContext();
    const [generatedSeed, setGeneratedSeed] = useState('');
    const [generatedEscrow, setGeneratedEscrow] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        reset();
        const signer = createSigner();
        if (!signer) return;

        const escrowSeed = await generateKeyPairSigner();
        setGeneratedSeed(escrowSeed.address);
        const [escrow] = await findEscrowPda(
            { escrowSeed: escrowSeed.address },
            { programAddress: programId as Address },
        );
        setGeneratedEscrow(escrow);

        const ix = await getCreatesEscrowInstructionAsync(
            {
                admin: signer,
                escrowSeed,
                payer: signer,
            },
            { programAddress: programId as Address },
        );
        const txSignature = await send([ix], {
            action: 'Create Escrow',
            values: { escrow },
        });
        if (txSignature) {
            rememberEscrow(escrow);
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
            <FormField
                label="Admin Address"
                value={account?.address ?? ''}
                onChange={() => {}}
                placeholder="Connect wallet first"
                hint="The admin authority for the escrow (connected wallet)"
                readOnly
            />
            {generatedSeed && (
                <FormField
                    label="Generated Escrow Seed"
                    value={generatedSeed}
                    onChange={() => {}}
                    readOnly
                    hint="Auto-generated keypair used as escrow PDA seed"
                />
            )}
            {generatedEscrow && (
                <FormField
                    label="Generated Escrow PDA"
                    value={generatedEscrow}
                    onChange={() => {}}
                    readOnly
                    hint="Saved as the default escrow when creation succeeds"
                />
            )}
            <SendButton sending={sending} label={submitLabel} />
            <TxResult signature={signature} error={error} />
        </form>
    );
}
