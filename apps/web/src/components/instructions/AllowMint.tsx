'use client';

import { useState } from 'react';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useEscrowMutations } from '@/hooks/use-escrow-mutations';
import { useTokenFormDefaults } from '@/hooks/use-token-form-defaults';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress, validateOptionalAddress } from '@/lib/validation';
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
    const { allowMint } = useEscrowMutations();
    const { defaultEscrow, defaultMint, rememberEscrow, rememberMint } = useSavedValues();
    const [escrow, setEscrow] = useState(initialEscrow);
    const { clusterMint, mint, setMint, setTokenProgram, tokenProgram } = useTokenFormDefaults(initialMint);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        allowMint.reset();
        setFormError(null);

        const validationError = firstValidationError(
            validateAddress(escrow, 'Escrow address'),
            validateAddress(mint, 'Mint address'),
            validateOptionalAddress(tokenProgram, 'Token program'),
        );
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const result = await allowMint.mutateAsync({ escrow, mint, tokenProgram }).catch(() => null);
        if (!result) return;

        rememberEscrow(escrow);
        rememberMint(mint);
        onSuccess?.();
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
                        autoFillValue={defaultMint || clusterMint}
                        onAutoFill={setMint}
                        placeholder="SPL token mint to allow"
                        required
                    />
                </>
            )}
            <FormField
                label="Token Program"
                value={tokenProgram}
                onChange={setTokenProgram}
                placeholder="Token program address"
                hint="Use Token-2022 program address for Token-2022 mints"
            />
            <SendButton sending={allowMint.isPending} label={submitLabel} />
            <TxResult signature={allowMint.data?.signature} error={formError ?? allowMint.error} />
        </form>
    );
}
