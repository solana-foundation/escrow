'use client';

import { useState } from 'react';
import { Badge } from '@solana/design-system/badge';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useEscrowMutations } from '@/hooks/use-escrow-mutations';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress } from '@/lib/validation';
import { FormField, SendButton } from './shared';

interface SetArbiterProps {
    hideKnownFields?: boolean;
    initialEscrow?: string;
    onSuccess?: () => void;
    submitLabel?: string;
}

export function SetArbiter({
    hideKnownFields = false,
    initialEscrow = '',
    onSuccess,
    submitLabel,
}: SetArbiterProps = {}) {
    const { setArbiter } = useEscrowMutations();
    const { defaultEscrow, rememberEscrow } = useSavedValues();
    const [escrow, setEscrow] = useState(initialEscrow);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setArbiter.reset();
        setFormError(null);

        const validationError = firstValidationError(validateAddress(escrow, 'Escrow address'));
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const result = await setArbiter.mutateAsync({ escrow }).catch(() => null);
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
                <Badge variant="info">
                    Arbiter must co-sign with admin. This form sets your connected wallet as arbiter.
                </Badge>
            </div>
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
            <SendButton sending={setArbiter.isPending} label={submitLabel} />
            <TxResult signature={setArbiter.data?.signature} error={formError ?? setArbiter.error} />
        </form>
    );
}
