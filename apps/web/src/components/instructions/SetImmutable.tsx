'use client';

import { useState } from 'react';
import { Badge } from '@solana/design-system/badge';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useEscrowMutations } from '@/hooks/use-escrow-mutations';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress } from '@/lib/validation';
import { FormField, SendButton } from './shared';

interface SetImmutableProps {
    hideKnownFields?: boolean;
    initialEscrow?: string;
    onSuccess?: () => void;
    submitLabel?: string;
}

export function SetImmutable({
    hideKnownFields = false,
    initialEscrow = '',
    onSuccess,
    submitLabel,
}: SetImmutableProps = {}) {
    const { setImmutable } = useEscrowMutations();
    const { defaultEscrow, rememberEscrow } = useSavedValues();
    const [escrow, setEscrow] = useState(initialEscrow);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setImmutable.reset();
        setFormError(null);

        const validationError = firstValidationError(validateAddress(escrow, 'Escrow address'));
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const result = await setImmutable.mutateAsync({ escrow }).catch(() => null);
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
            <div>
                <Badge variant="warning">
                    This action is one-way. Escrow configuration becomes permanently immutable. Any configured hook also
                    becomes permanent, and hook reverts will block escrow operations.
                </Badge>
            </div>
            {!hideKnownFields && (
                <FormField
                    label="Escrow Address"
                    value={escrow}
                    onChange={setEscrow}
                    autoFillValue={defaultEscrow}
                    onAutoFill={setEscrow}
                    placeholder="Escrowae7..."
                    required
                />
            )}
            <SendButton sending={setImmutable.isPending} label={submitLabel} />
            <TxResult signature={setImmutable.data?.signature} error={formError ?? setImmutable.error} />
        </form>
    );
}
