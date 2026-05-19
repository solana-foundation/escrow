'use client';

import { useState } from 'react';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useEscrowMutations } from '@/hooks/use-escrow-mutations';
import { TxResult } from '@/components/TxResult';
import { FormField, SendButton } from './shared';

interface CreateEscrowProps {
    onSuccess?: () => void;
    submitLabel?: string;
}

export function CreateEscrow({ onSuccess, submitLabel }: CreateEscrowProps = {}) {
    const { account } = useWallet();
    const { createEscrow } = useEscrowMutations();
    const { rememberEscrow } = useSavedValues();
    const [generatedSeed, setGeneratedSeed] = useState('');
    const [generatedEscrow, setGeneratedEscrow] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        createEscrow.reset();

        const result = await createEscrow.mutateAsync().catch(() => null);
        if (!result) return;

        setGeneratedSeed(result.seed);
        setGeneratedEscrow(result.escrow);
        rememberEscrow(result.escrow);
        onSuccess?.();
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
            <SendButton sending={createEscrow.isPending} label={submitLabel} />
            <TxResult signature={createEscrow.data?.signature} error={createEscrow.error} />
        </form>
    );
}
