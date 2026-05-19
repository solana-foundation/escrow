'use client';

import { useState } from 'react';
import type { Address } from '@solana/kit';
import { Badge } from '@solana/design-system/badge';
import { findExtensionsPda, getSetArbiterInstructionAsync } from '@solana/escrow';
import { useSendTx } from '@/hooks/useSendTx';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useProgramContext } from '@/contexts/ProgramContext';
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
    const { createSigner } = useWallet();
    const { send, sending, signature, error, reset } = useSendTx();
    const { defaultEscrow, rememberEscrow } = useSavedValues();
    const { programId } = useProgramContext();
    const [escrow, setEscrow] = useState(initialEscrow);
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

        const [, extensionsBump] = await findExtensionsPda(
            { escrow: escrow as Address },
            { programAddress: programId as Address },
        );
        const ix = await getSetArbiterInstructionAsync(
            {
                admin: signer,
                arbiter: signer,
                escrow: escrow as Address,
                extensionsBump,
                payer: signer,
            },
            { programAddress: programId as Address },
        );
        const txSignature = await send([ix], {
            action: 'Set Arbiter',
            values: { escrow },
        });
        if (txSignature) {
            rememberEscrow(escrow);
            onSuccess?.();
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
            <SendButton sending={sending} label={submitLabel} />
            <TxResult signature={signature} error={formError ?? error} />
        </form>
    );
}
