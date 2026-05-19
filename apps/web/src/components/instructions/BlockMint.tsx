'use client';

import { useState } from 'react';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useEscrowMutations } from '@/hooks/use-escrow-mutations';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress, validateOptionalAddress } from '@/lib/validation';
import { FormField, SendButton } from './shared';

interface BlockMintProps {
    hideKnownFields?: boolean;
    initialEscrow?: string;
    initialMint?: string;
    initialRentRecipient?: string;
    onSuccess?: () => void;
    submitLabel?: string;
}

export function BlockMint({
    hideKnownFields = false,
    initialEscrow = '',
    initialMint = '',
    initialRentRecipient = '',
    onSuccess,
    submitLabel,
}: BlockMintProps = {}) {
    const { account } = useWallet();
    const { blockMint } = useEscrowMutations();
    const { defaultEscrow, defaultMint, rememberEscrow, rememberMint } = useSavedValues();
    const [escrow, setEscrow] = useState(initialEscrow);
    const [mint, setMint] = useState(initialMint);
    const [rentRecipient, setRentRecipient] = useState(initialRentRecipient);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        blockMint.reset();
        setFormError(null);

        const validationError = firstValidationError(
            validateAddress(escrow, 'Escrow address'),
            validateAddress(mint, 'Mint address'),
            validateOptionalAddress(rentRecipient, 'Rent recipient'),
        );
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const result = await blockMint.mutateAsync({ escrow, mint, rentRecipient }).catch(() => null);
        if (!result) return;

        rememberEscrow(escrow);
        rememberMint(mint);
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
                <>
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
                        label="Mint Address"
                        value={mint}
                        onChange={setMint}
                        autoFillValue={defaultMint}
                        onAutoFill={setMint}
                        placeholder="SPL token mint to block"
                        required
                    />
                </>
            )}
            <FormField
                label="Rent Recipient"
                value={rentRecipient}
                onChange={setRentRecipient}
                placeholder={account?.address ?? 'Defaults to connected wallet'}
                hint="Address that receives rent from the closed allowed-mint account"
            />
            <SendButton sending={blockMint.isPending} label={submitLabel} />
            <TxResult signature={blockMint.data?.signature} error={formError ?? blockMint.error} />
        </form>
    );
}
