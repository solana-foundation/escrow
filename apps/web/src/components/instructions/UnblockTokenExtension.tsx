'use client';

import { useState } from 'react';
import type { Address } from '@solana/kit';
import { getUnblockTokenExtensionInstructionAsync } from '@solana/escrow';
import { useSendTx } from '@/hooks/useSendTx';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useProgramContext } from '@/contexts/ProgramContext';
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

export function UnblockTokenExtension() {
    const { createSigner } = useWallet();
    const { send, sending, signature, error, reset } = useSendTx();
    const { defaultEscrow, rememberEscrow } = useSavedValues();
    const { programId } = useProgramContext();
    const [escrow, setEscrow] = useState('');
    const [blockedExtension, setBlockedExtension] = useState('5');
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

        const ix = await getUnblockTokenExtensionInstructionAsync(
            {
                admin: signer,
                escrow: escrow as Address,
                blockedExtension: Number(blockedExtension),
                payer: signer,
            },
            { programAddress: programId as Address },
        );
        const txSignature = await send([ix], {
            action: 'Unblock Token Extension',
            values: { escrow, extensionType: blockedExtension },
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
                value={blockedExtension}
                onChange={setBlockedExtension}
                options={EXTENSION_OPTIONS}
                hint="Token-2022 extension type to remove from escrow blocked list"
            />
            <SendButton sending={sending} />
            <TxResult signature={signature} error={formError ?? error} />
        </form>
    );
}
