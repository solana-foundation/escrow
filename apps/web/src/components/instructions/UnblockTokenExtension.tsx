'use client';

import { useState } from 'react';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useEscrowMutations } from '@/hooks/use-escrow-mutations';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress } from '@/lib/validation';
import { FormField, SelectField, SendButton } from './shared';

const EXTENSION_OPTIONS = [
    { label: 'NonTransferable (5)', value: '5' },
    { label: 'PermanentDelegate (8)', value: '8' },
    { label: 'TransferHook (16)', value: '16' },
    { label: 'Pausable (25)', value: '25' },
    { label: 'TransferFeeConfig (1)', value: '1' },
    { label: 'MintCloseAuthority (3)', value: '3' },
    { label: 'MetadataPointer (18)', value: '18' },
];

interface UnblockTokenExtensionProps {
    hideKnownFields?: boolean;
    initialEscrow?: string;
    initialExtensionType?: string;
    onSuccess?: () => void;
    submitLabel?: string;
}

export function UnblockTokenExtension({
    hideKnownFields = false,
    initialEscrow = '',
    initialExtensionType = '5',
    onSuccess,
    submitLabel,
}: UnblockTokenExtensionProps = {}) {
    const { unblockTokenExtension } = useEscrowMutations();
    const { defaultEscrow, rememberEscrow } = useSavedValues();
    const [escrow, setEscrow] = useState(initialEscrow);
    const [blockedExtension, setBlockedExtension] = useState(initialExtensionType);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        unblockTokenExtension.reset();
        setFormError(null);

        const validationError = firstValidationError(validateAddress(escrow, 'Escrow address'));
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const result = await unblockTokenExtension
            .mutateAsync({ escrow, extensionType: Number(blockedExtension) })
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
                value={blockedExtension}
                onChange={setBlockedExtension}
                options={EXTENSION_OPTIONS}
                hint="Token-2022 extension type to remove from escrow blocked list"
            />
            <SendButton sending={unblockTokenExtension.isPending} label={submitLabel} />
            <TxResult
                signature={unblockTokenExtension.data?.signature}
                error={formError ?? unblockTokenExtension.error}
            />
        </form>
    );
}
