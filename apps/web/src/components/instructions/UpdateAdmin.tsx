'use client';

import { useState } from 'react';
import type { Address } from '@solana/kit';
import { Badge } from '@solana/design-system/badge';
import { getUpdateAdminInstruction } from '@solana/escrow';
import { useSendTx } from '@/hooks/useSendTx';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useProgramContext } from '@/contexts/ProgramContext';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress } from '@/lib/validation';
import { FormField, SendButton } from './shared';

export function UpdateAdmin() {
    const { createSigner } = useWallet();
    const { send, sending, signature, error, reset } = useSendTx();
    const { defaultEscrow, rememberEscrow } = useSavedValues();
    const { programId } = useProgramContext();
    const [escrow, setEscrow] = useState('');
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

        const ix = getUpdateAdminInstruction(
            {
                admin: signer,
                newAdmin: signer,
                escrow: escrow as Address,
            },
            { programAddress: programId as Address },
        );
        const txSignature = await send([ix], {
            action: 'Update Admin',
            values: { escrow },
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
            <div>
                <Badge variant="info">Current and new admin must both sign. This form uses your wallet for both.</Badge>
            </div>
            <FormField
                label="Escrow Address"
                value={escrow}
                onChange={setEscrow}
                autoFillValue={defaultEscrow}
                onAutoFill={setEscrow}
                placeholder="Escrowae7..."
                required
            />
            <SendButton sending={sending} />
            <TxResult signature={signature} error={formError ?? error} />
        </form>
    );
}
