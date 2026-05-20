'use client';

import { useState } from 'react';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useEscrowMutations } from '@/hooks/use-escrow-mutations';
import { useTokenFormDefaults } from '@/hooks/use-token-form-defaults';
import { TxResult } from '@/components/TxResult';
import {
    firstValidationError,
    validateAddress,
    validateOptionalAddress,
    validatePositiveInteger,
} from '@/lib/validation';
import { FormField, SendButton } from './shared';

interface DepositProps {
    hideKnownFields?: boolean;
    initialAmount?: string;
    initialEscrow?: string;
    initialMint?: string;
    onSuccess?: () => void;
    submitLabel?: string;
}

export function Deposit({
    hideKnownFields = false,
    initialAmount = '',
    initialEscrow = '',
    initialMint = '',
    onSuccess,
    submitLabel,
}: DepositProps = {}) {
    const { deposit } = useEscrowMutations();
    const { defaultEscrow, defaultMint, rememberEscrow, rememberMint, rememberReceipt } = useSavedValues();
    const [escrow, setEscrow] = useState(initialEscrow);
    const { clusterMint, mint, setMint, setTokenProgram, tokenProgram } = useTokenFormDefaults(initialMint);
    const [amount, setAmount] = useState(initialAmount);
    const [generatedSeed, setGeneratedSeed] = useState('');
    const [generatedReceipt, setGeneratedReceipt] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        deposit.reset();
        setFormError(null);

        const validationError = firstValidationError(
            validateAddress(escrow, 'Escrow address'),
            validateAddress(mint, 'Mint address'),
            validatePositiveInteger(amount, 'Amount'),
            validateOptionalAddress(tokenProgram, 'Token program'),
        );
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const result = await deposit
            .mutateAsync({
                amount: BigInt(amount),
                escrow,
                mint,
                tokenProgram,
            })
            .catch(() => null);
        if (!result) return;

        setGeneratedSeed(result.receiptSeed);
        setGeneratedReceipt(result.receipt);
        rememberEscrow(result.escrow);
        rememberMint(result.mint);
        rememberReceipt(result.receipt);
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
                </>
            )}
            <FormField
                label="Amount (in base units)"
                value={amount}
                onChange={setAmount}
                placeholder="e.g. 1000000 for 1 token with 6 decimals"
                type="number"
                hint="Amount in smallest token units (no decimals)"
                required
            />
            <FormField
                label="Token Program"
                value={tokenProgram}
                onChange={setTokenProgram}
                placeholder="Token program address"
                hint="Use Token-2022 program address for Token-2022 mints"
            />
            {generatedSeed && (
                <FormField
                    label="Generated Receipt Seed"
                    value={generatedSeed}
                    onChange={() => {}}
                    readOnly
                    hint="Random seed used to derive the receipt PDA"
                />
            )}
            {generatedReceipt && (
                <FormField
                    label="Generated Receipt PDA"
                    value={generatedReceipt}
                    onChange={() => {}}
                    readOnly
                    hint="Saved as the default receipt when deposit succeeds"
                />
            )}
            <SendButton sending={deposit.isPending} label={submitLabel} />
            <TxResult signature={deposit.data?.signature} error={formError ?? deposit.error} />
        </form>
    );
}
