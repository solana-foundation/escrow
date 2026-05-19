'use client';

import { useState } from 'react';
import type { Address } from '@solana/kit';
import { Badge } from '@solana/design-system/badge';
import { getSetImmutableInstruction } from '@solana/escrow';
import { useSendTx } from '@/hooks/useSendTx';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useProgramContext } from '@/contexts/ProgramContext';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress } from '@/lib/validation';
import { FormField, SendButton } from './shared';

export function SetImmutable() {
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

        const ix = getSetImmutableInstruction(
            {
                admin: signer,
                escrow: escrow as Address,
            },
            { programAddress: programId as Address },
        );

        const txSignature = await send([ix], {
            action: 'Set Immutable',
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
                <Badge variant="warning">
                    This action is one-way. Escrow configuration becomes permanently immutable. Any configured hook also
                    becomes permanent, and hook reverts will block escrow operations.
                </Badge>
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
