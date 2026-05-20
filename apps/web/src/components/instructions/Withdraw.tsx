'use client';

import { useState } from 'react';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useEscrowMutations } from '@/hooks/use-escrow-mutations';
import { useTokenFormDefaults } from '@/hooks/use-token-form-defaults';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress, validateOptionalAddress } from '@/lib/validation';
import { FormField, SendButton } from './shared';

interface WithdrawProps {
    hideKnownFields?: boolean;
    initialEscrow?: string;
    initialMint?: string;
    initialReceipt?: string;
    initialRentRecipient?: string;
    onSuccess?: () => void;
    submitLabel?: string;
}

export function Withdraw({
    hideKnownFields = false,
    initialEscrow = '',
    initialMint = '',
    initialReceipt = '',
    initialRentRecipient = '',
    onSuccess,
    submitLabel,
}: WithdrawProps = {}) {
    const { account } = useWallet();
    const { withdraw } = useEscrowMutations();
    const { defaultEscrow, defaultMint, defaultReceipt, rememberEscrow, rememberMint, rememberReceipt } =
        useSavedValues();
    const [escrow, setEscrow] = useState(initialEscrow);
    const { clusterMint, mint, setMint, setTokenProgram, tokenProgram } = useTokenFormDefaults(initialMint);
    const [receipt, setReceipt] = useState(initialReceipt);
    const [rentRecipient, setRentRecipient] = useState(initialRentRecipient);
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        withdraw.reset();
        setFormError(null);

        const validationError = firstValidationError(
            validateAddress(escrow, 'Escrow address'),
            validateAddress(mint, 'Mint address'),
            validateAddress(receipt, 'Receipt address'),
            validateOptionalAddress(rentRecipient, 'Rent recipient'),
            validateOptionalAddress(tokenProgram, 'Token program'),
        );
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const result = await withdraw
            .mutateAsync({
                escrow,
                mint,
                receipt,
                rentRecipient,
                tokenProgram,
            })
            .catch(() => null);
        if (!result) return;

        rememberEscrow(escrow);
        rememberMint(mint);
        rememberReceipt(receipt);
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
                        autoFillValue={defaultMint || clusterMint}
                        onAutoFill={setMint}
                        placeholder="SPL token mint address"
                        required
                    />
                    <FormField
                        label="Receipt Address"
                        value={receipt}
                        onChange={setReceipt}
                        autoFillValue={defaultReceipt}
                        onAutoFill={setReceipt}
                        placeholder="Receipt PDA address from deposit"
                        hint="The receipt PDA created during Deposit"
                        required
                    />
                </>
            )}
            <FormField
                label="Rent Recipient"
                value={rentRecipient}
                onChange={setRentRecipient}
                placeholder={account?.address ?? 'Defaults to connected wallet'}
                hint="Address that receives rent from the closed receipt account"
            />
            <FormField
                label="Token Program"
                value={tokenProgram}
                onChange={setTokenProgram}
                placeholder="Token program address"
                hint="Use Token-2022 program address for Token-2022 mints"
            />
            <SendButton sending={withdraw.isPending} label={submitLabel} />
            <TxResult signature={withdraw.data?.signature} error={formError ?? withdraw.error} />
        </form>
    );
}
