'use client';

import { useState } from 'react';
import type { Address } from '@solana/kit';
import { getRemoveExtensionInstructionAsync } from '@solana/escrow';
import { useSendTx } from '@/hooks/useSendTx';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useProgramContext } from '@/contexts/ProgramContext';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress } from '@/lib/validation';
import { FormField, SelectField, SendButton } from './shared';

const EXTENSION_OPTIONS = [
    { label: 'Timelock (0)', value: '0' },
    { label: 'Hook (1)', value: '1' },
    { label: 'Blocked Token Extensions (2)', value: '2' },
    { label: 'Arbiter (3)', value: '3' },
];

export function RemoveExtension() {
    const { createSigner } = useWallet();
    const { send, sending, signature, error, reset } = useSendTx();
    const { defaultEscrow, rememberEscrow } = useSavedValues();
    const { programId } = useProgramContext();
    const [escrow, setEscrow] = useState('');
    const [extensionType, setExtensionType] = useState('0');
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        reset();
        setFormError(null);
        const signer = createSigner();
        if (!signer) return;

        const validationError = firstValidationError(validateAddress(escrow, 'Escrow address'));
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const ix = await getRemoveExtensionInstructionAsync(
            {
                admin: signer,
                escrow: escrow as Address,
                extensionType: Number(extensionType),
                payer: signer,
            },
            { programAddress: programId as Address },
        );
        const txSignature = await send([ix], {
            action: 'Remove Extension',
            values: { escrow, extensionType },
        });
        if (txSignature) {
            rememberEscrow(escrow);
        }
    };

    return (
        <form
            onSubmit={e => {
                void handleSubmit(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        >
            <FormField
                label="Escrow Address"
                value={escrow}
                onChange={setEscrow}
                autoFillValue={defaultEscrow}
                onAutoFill={setEscrow}
                placeholder="Escrow PDA address"
                required
            />
            <SelectField
                label="Extension Type"
                value={extensionType}
                onChange={setExtensionType}
                options={EXTENSION_OPTIONS}
                hint="Select which escrow extension to remove"
            />
            <SendButton sending={sending} />
            <TxResult signature={signature} error={formError ?? error} />
        </form>
    );
}
