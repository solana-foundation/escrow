'use client';

import { useState } from 'react';
import { AccountRole, type Address, fetchEncodedAccount, createSolanaRpc, getAddressDecoder } from '@solana/kit';
import { findExtensionsPda, getWithdrawInstructionAsync } from '@solana/escrow';
import { useSendTx } from '@/hooks/useSendTx';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useProgramContext } from '@/contexts/ProgramContext';
import { useRpcContext } from '@/contexts/RpcContext';
import { TxResult } from '@/components/TxResult';
import { firstValidationError, validateAddress, validateOptionalAddress } from '@/lib/validation';
import { FormField, SendButton } from './shared';

// TLV layout: [discriminator(1), version(1), bump(1), extensionCount(1), ...entries]
// Each entry: [type(u16-LE), length(u16-LE), data(length bytes)]
const HEADER_SIZE = 4;
const ENTRY_HEADER_SIZE = 4;
const HOOK_TYPE = 1;
const ARBITER_TYPE = 3;

function parseExtensions(data: Uint8Array): { arbiter: Address | null; hookProgram: Address | null } {
    let arbiter: Address | null = null;
    let hookProgram: Address | null = null;

    const decoder = getAddressDecoder();
    let offset = HEADER_SIZE;

    while (offset + ENTRY_HEADER_SIZE <= data.length) {
        const type = data[offset] | (data[offset + 1] << 8);
        const length = data[offset + 2] | (data[offset + 3] << 8);
        const start = offset + ENTRY_HEADER_SIZE;
        const end = start + length;
        if (end > data.length) break;

        if (type === ARBITER_TYPE && length >= 32) {
            arbiter = decoder.decode(data.slice(start, start + 32));
        } else if (type === HOOK_TYPE && length >= 32) {
            hookProgram = decoder.decode(data.slice(start, start + 32));
        }

        offset = end;
    }

    return { arbiter, hookProgram };
}

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
    const { account, createSigner } = useWallet();
    const { send, sending, signature, error, reset } = useSendTx();
    const { defaultEscrow, defaultMint, defaultReceipt, rememberEscrow, rememberMint, rememberReceipt } =
        useSavedValues();
    const { programId } = useProgramContext();
    const { rpcUrl } = useRpcContext();
    const [escrow, setEscrow] = useState(initialEscrow);
    const [mint, setMint] = useState(initialMint);
    const [receipt, setReceipt] = useState(initialReceipt);
    const [rentRecipient, setRentRecipient] = useState(initialRentRecipient);
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
            validateAddress(receipt, 'Receipt address'),
            validateOptionalAddress(rentRecipient, 'Rent recipient'),
        );
        if (validationError) {
            setFormError(validationError);
            return;
        }

        // Auto-detect arbiter + hook from the extensions PDA and append as remaining accounts.
        const [extensionsPda] = await findExtensionsPda(
            { escrow: escrow as Address },
            { programAddress: programId as Address },
        );
        const rpc = createSolanaRpc(rpcUrl);
        const extensionsAccount = await fetchEncodedAccount(rpc, extensionsPda);

        const remainingAccounts: object[] = [];
        if (extensionsAccount.exists) {
            const { arbiter, hookProgram } = parseExtensions(new Uint8Array(extensionsAccount.data));
            // Arbiter must be first and must sign.
            // If the arbiter is the connected wallet, attach the signer so @solana/kit's
            // signTransactionMessageWithSigners knows to call it.
            if (arbiter) {
                remainingAccounts.push(
                    arbiter === (signer.address as string)
                        ? { address: arbiter, role: AccountRole.READONLY_SIGNER, signer }
                        : { address: arbiter, role: AccountRole.READONLY_SIGNER },
                );
            }
            // Hook program comes after arbiter (the processor slices past it before invoking the hook).
            if (hookProgram) remainingAccounts.push({ address: hookProgram, role: AccountRole.READONLY });
        }

        const ix = await getWithdrawInstructionAsync(
            {
                withdrawer: signer,
                escrow: escrow as Address,
                mint: mint as Address,
                receipt: receipt as Address,
                rentRecipient: (rentRecipient || signer.address) as Address,
            },
            { programAddress: programId as Address },
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finalIx: any =
            remainingAccounts.length > 0 ? { ...ix, accounts: [...ix.accounts, ...remainingAccounts] } : ix;

        const txSignature = await send([finalIx], {
            action: 'Withdraw',
            values: { escrow, mint, receipt, rentRecipient: rentRecipient || account?.address || '' },
        });
        if (txSignature) {
            rememberEscrow(escrow);
            rememberMint(mint);
            rememberReceipt(receipt);
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
            <SendButton sending={sending} label={submitLabel} />
            <TxResult signature={signature} error={formError ?? error} />
        </form>
    );
}
