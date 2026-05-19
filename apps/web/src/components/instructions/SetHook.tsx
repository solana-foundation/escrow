'use client';

import { useState } from 'react';
import type { Address } from '@solana/kit';
import { getSetHookInstructionAsync } from '@solana/escrow';
import { useSendTx } from '@/hooks/useSendTx';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useProgramContext } from '@/contexts/ProgramContext';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress } from '@/lib/validation';
import { FormField, SendButton } from './shared';

interface SetHookProps {
    hideKnownFields?: boolean;
    initialEscrow?: string;
    initialHookProgram?: string;
    onSuccess?: () => void;
    submitLabel?: string;
}

export function SetHook({
    hideKnownFields = false,
    initialEscrow = '',
    initialHookProgram = '',
    onSuccess,
    submitLabel,
}: SetHookProps = {}) {
    const { createSigner } = useWallet();
    const { send, sending, signature, error, reset } = useSendTx();
    const { defaultEscrow, rememberEscrow } = useSavedValues();
    const { programId } = useProgramContext();
    const [escrow, setEscrow] = useState(initialEscrow);
    const [hookProgram, setHookProgram] = useState(initialHookProgram);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        reset();
        setFormError(null);
        const signer = createSigner();
        if (!signer) return;

        const validationError = firstValidationError(
            validateAddress(escrow, 'Escrow address'),
            validateAddress(hookProgram, 'Hook program address'),
        );
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const ix = await getSetHookInstructionAsync(
            {
                admin: signer,
                escrow: escrow as Address,
                hookProgram: hookProgram as Address,
                payer: signer,
            },
            { programAddress: programId as Address },
        );
        const txSignature = await send([ix], {
            action: 'Set Hook',
            values: { escrow, hookProgram },
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
            {!hideKnownFields && (
                <FormField
                    label="Escrow Address"
                    value={escrow}
                    onChange={setEscrow}
                    autoFillValue={defaultEscrow}
                    onAutoFill={setEscrow}
                    placeholder="Escrow PDA address"
                    required
                />
            )}
            <FormField
                label="Hook Program Address"
                value={hookProgram}
                onChange={setHookProgram}
                placeholder="Program ID implementing the transfer hook"
                hint="Warning: if this escrow is later set immutable, this hook dependency becomes permanent and hook reverts will block operations."
                required
            />
            <SendButton sending={sending} label={submitLabel} />
            <TxResult signature={signature} error={formError ?? error} />
        </form>
    );
}
