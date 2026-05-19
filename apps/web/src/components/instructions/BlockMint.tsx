'use client';

import { useState } from 'react';
import type { Address } from '@solana/kit';
import { getBlockMintInstructionAsync } from '@solana/escrow';
import { useSendTx } from '@/hooks/useSendTx';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useProgramContext } from '@/contexts/ProgramContext';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress, validateOptionalAddress } from '@/lib/validation';
import { FormField, SendButton } from './shared';

export function BlockMint() {
    const { account, createSigner } = useWallet();
    const { send, sending, signature, error, reset } = useSendTx();
    const { defaultEscrow, defaultMint, rememberEscrow, rememberMint } = useSavedValues();
    const { programId } = useProgramContext();
    const [escrow, setEscrow] = useState('');
    const [mint, setMint] = useState('');
    const [rentRecipient, setRentRecipient] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        reset();
        setFormError(null);
        const signer = createSigner();
        if (!signer) return;

        const validationError = firstValidationError(
            validateAddress(escrow, 'Escrow address'),
            validateAddress(mint, 'Mint address'),
            validateOptionalAddress(rentRecipient, 'Rent recipient'),
        );
        if (validationError) {
            setFormError(validationError);
            return;
        }

        const ix = await getBlockMintInstructionAsync(
            {
                admin: signer,
                escrow: escrow as Address,
                mint: mint as Address,
                rentRecipient: (rentRecipient || signer.address) as Address,
            },
            { programAddress: programId as Address },
        );
        const txSignature = await send([ix], {
            action: 'Block Mint',
            values: { escrow, mint, rentRecipient: rentRecipient || account?.address || '' },
        });
        if (txSignature) {
            rememberEscrow(escrow);
            rememberMint(mint);
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
                label="Mint Address"
                value={mint}
                onChange={setMint}
                autoFillValue={defaultMint}
                onAutoFill={setMint}
                placeholder="SPL token mint to block"
                required
            />
            <FormField
                label="Rent Recipient"
                value={rentRecipient}
                onChange={setRentRecipient}
                placeholder={account?.address ?? 'Defaults to connected wallet'}
                hint="Address that receives rent from the closed allowed-mint account"
            />
            <SendButton sending={sending} />
            <TxResult signature={signature} error={formError ?? error} />
        </form>
    );
}
