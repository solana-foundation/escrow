'use client';

import { useState } from 'react';
import { Badge } from '@solana/design-system/badge';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useEscrowMutations } from '@/hooks/use-escrow-mutations';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress } from '@/lib/validation';
import { FormField, SendButton } from './shared';

interface UpdateAdminProps {
    hideKnownFields?: boolean;
    initialEscrow?: string;
    onSuccess?: () => void;
    submitLabel?: string;
}

export function UpdateAdmin({
    hideKnownFields = false,
    initialEscrow = '',
    onSuccess,
    submitLabel,
}: UpdateAdminProps = {}) {
    const { updateAdmin } = useEscrowMutations();
    const { defaultEscrow, rememberEscrow } = useSavedValues();
    const [escrow, setEscrow] = useState(initialEscrow);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        updateAdmin.reset();
        setFormError(null);

        const validationError = firstValidationError(validateAddress(escrow, 'Escrow address'));
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const result = await updateAdmin.mutateAsync({ escrow }).catch(() => null);
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
                <Badge variant="info">Current and new admin must both sign. This form uses your wallet for both.</Badge>
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
            <SendButton sending={updateAdmin.isPending} label={submitLabel} />
            <TxResult signature={updateAdmin.data?.signature} error={formError ?? updateAdmin.error} />
        </form>
    );
}
