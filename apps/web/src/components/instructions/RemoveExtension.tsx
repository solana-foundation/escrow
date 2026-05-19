'use client';

import { useState } from 'react';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useEscrowMutations } from '@/hooks/use-escrow-mutations';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress } from '@/lib/validation';
import { FormField, SelectField, SendButton } from './shared';

const EXTENSION_OPTIONS = [
    { label: 'Timelock (0)', value: '0' },
    { label: 'Hook (1)', value: '1' },
    { label: 'Blocked Token Extensions (2)', value: '2' },
    { label: 'Arbiter (3)', value: '3' },
];

interface RemoveExtensionProps {
    hideKnownFields?: boolean;
    initialEscrow?: string;
    initialExtensionType?: string;
    onSuccess?: () => void;
    submitLabel?: string;
}

export function RemoveExtension({
    hideKnownFields = false,
    initialEscrow = '',
    initialExtensionType = '0',
    onSuccess,
    submitLabel,
}: RemoveExtensionProps = {}) {
    const { removeExtension } = useEscrowMutations();
    const { defaultEscrow, rememberEscrow } = useSavedValues();
    const [escrow, setEscrow] = useState(initialEscrow);
    const [extensionType, setExtensionType] = useState(initialExtensionType);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        removeExtension.reset();
        setFormError(null);

        const validationError = firstValidationError(validateAddress(escrow, 'Escrow address'));
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const result = await removeExtension
            .mutateAsync({ escrow, extensionType: Number(extensionType) })
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
            <SelectField
                label="Extension Type"
                value={extensionType}
                onChange={setExtensionType}
                options={EXTENSION_OPTIONS}
                hint="Select which escrow extension to remove"
            />
            <SendButton sending={removeExtension.isPending} label={submitLabel} />
            <TxResult signature={removeExtension.data?.signature} error={formError ?? removeExtension.error} />
        </form>
    );
}
