'use client';

import { useState } from 'react';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useEscrowMutations } from '@/hooks/use-escrow-mutations';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress, validatePositiveInteger } from '@/lib/validation';
import { FormField, SendButton } from './shared';

interface AddTimelockProps {
    hideKnownFields?: boolean;
    initialEscrow?: string;
    initialLockDuration?: string;
    onSuccess?: () => void;
    submitLabel?: string;
}

export function AddTimelock({
    hideKnownFields = false,
    initialEscrow = '',
    initialLockDuration = '',
    onSuccess,
    submitLabel,
}: AddTimelockProps = {}) {
    const { addTimelock } = useEscrowMutations();
    const { defaultEscrow, rememberEscrow } = useSavedValues();
    const [escrow, setEscrow] = useState(initialEscrow);
    const [lockDuration, setLockDuration] = useState(initialLockDuration);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        addTimelock.reset();
        setFormError(null);

        const validationError = firstValidationError(
            validateAddress(escrow, 'Escrow address'),
            validatePositiveInteger(lockDuration, 'Lock duration'),
        );
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const result = await addTimelock
            .mutateAsync({
                escrow,
                lockDuration: BigInt(lockDuration),
            })
            .catch(() => null);
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
                label="Lock Duration (seconds)"
                value={lockDuration}
                onChange={setLockDuration}
                placeholder="e.g. 3600 for 1 hour"
                type="number"
                required
            />
            <SendButton sending={addTimelock.isPending} label={submitLabel} />
            <TxResult signature={addTimelock.data?.signature} error={formError ?? addTimelock.error} />
        </form>
    );
}
