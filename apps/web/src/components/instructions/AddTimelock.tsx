'use client';

import { useState } from 'react';
import type { Address } from '@solana/kit';
import { getAddTimelockInstructionAsync } from '@solana/escrow';
import { useSendTx } from '@/hooks/useSendTx';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useProgramContext } from '@/contexts/ProgramContext';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress, validatePositiveInteger } from '@/lib/validation';
import { FormField, SendButton } from './shared';

export function AddTimelock() {
    const { createSigner } = useWallet();
    const { send, sending, signature, error, reset } = useSendTx();
    const { defaultEscrow, rememberEscrow } = useSavedValues();
    const { programId } = useProgramContext();
    const [escrow, setEscrow] = useState('');
    const [lockDuration, setLockDuration] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        reset();
        setFormError(null);
        const signer = createSigner();
        if (!signer) return;

        const validationError = firstValidationError(
            validateAddress(escrow, 'Escrow address'),
            validatePositiveInteger(lockDuration, 'Lock duration'),
        );
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const ix = await getAddTimelockInstructionAsync(
            {
                admin: signer,
                escrow: escrow as Address,
                lockDuration: BigInt(lockDuration),
                payer: signer,
            },
            { programAddress: programId as Address },
        );
        const txSignature = await send([ix], {
            action: 'Add Timelock',
            values: { escrow, lockDuration },
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
            <FormField
                label="Lock Duration (seconds)"
                value={lockDuration}
                onChange={setLockDuration}
                placeholder="e.g. 3600 for 1 hour"
                type="number"
                required
            />
            <SendButton sending={sending} />
            <TxResult signature={signature} error={formError ?? error} />
        </form>
    );
}
