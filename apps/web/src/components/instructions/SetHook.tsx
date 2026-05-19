'use client';

import { useState } from 'react';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useEscrowMutations } from '@/hooks/use-escrow-mutations';
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
    const { setHook } = useEscrowMutations();
    const { defaultEscrow, rememberEscrow } = useSavedValues();
    const [escrow, setEscrow] = useState(initialEscrow);
    const [hookProgram, setHookProgram] = useState(initialHookProgram);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setHook.reset();
        setFormError(null);

        const validationError = firstValidationError(
            validateAddress(escrow, 'Escrow address'),
            validateAddress(hookProgram, 'Hook program address'),
        );
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const result = await setHook.mutateAsync({ escrow, hookProgram }).catch(() => null);
        if (!result) return;

        rememberEscrow(escrow);
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
            <SendButton sending={setHook.isPending} label={submitLabel} />
            <TxResult signature={setHook.data?.signature} error={formError ?? setHook.error} />
        </form>
    );
}
