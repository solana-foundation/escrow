import {
    findEscrowPda,
    findExtensionsPda,
    findReceiptPda,
    getAddTimelockInstructionAsync,
    getAllowMintInstructionAsync,
    getBlockMintInstructionAsync,
    getBlockTokenExtensionInstructionAsync,
    getCreatesEscrowInstructionAsync,
    getDepositInstructionAsync,
    getRemoveExtensionInstructionAsync,
    getSetArbiterInstructionAsync,
    getSetHookInstructionAsync,
    getSetImmutableInstruction,
    getUnblockTokenExtensionInstructionAsync,
    getWithdrawInstructionAsync,
} from '@solana/escrow';
import {
    type AccountMeta,
    AccountRole,
    type AccountSignerMeta,
    type Address,
    address,
    fetchEncodedAccount,
    generateKeyPairSigner,
    getAddressDecoder,
    type Instruction,
    type TransactionSigner,
} from '@solana/kit';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useWalletTransactionSignAndSend } from '@/components/solana/use-wallet-transaction-sign-and-send';
import { useTransactionToast } from '@/components/use-transaction-toast';
import { useProgramContext } from '@/contexts/ProgramContext';
import type { RecentTransactionValues } from '@/contexts/RecentTransactionsContext';
import { useRecentTransactions } from '@/contexts/RecentTransactionsContext';
import { useWallet } from '@/contexts/WalletContext';
import { normalizeTokenProgram } from '@/lib/token';
import { formatTransactionError } from '@/lib/transactionErrors';
import { invalidateWithDelay } from '@/lib/utils';

import { useRpc } from './useRpc';

const HEADER_SIZE = 4;
const ENTRY_HEADER_SIZE = 4;
const HOOK_TYPE = 1;
const ARBITER_TYPE = 3;

interface EscrowMutationResult {
    readonly signature: string;
}

interface CreateEscrowMutationResult extends EscrowMutationResult {
    readonly escrow: string;
    readonly seed: string;
}

interface DepositMutationResult extends EscrowMutationResult {
    readonly amount: bigint;
    readonly escrow: string;
    readonly mint: string;
    readonly receipt: string;
    readonly receiptSeed: string;
}

export interface DepositInput {
    readonly amount: bigint;
    readonly escrow: string;
    readonly mint: string;
    readonly tokenProgram: string;
}

export interface WithdrawInput {
    readonly escrow: string;
    readonly mint: string;
    readonly receipt: string;
    readonly rentRecipient?: string;
    readonly tokenProgram: string;
}

export interface EscrowMintInput {
    readonly escrow: string;
    readonly mint: string;
    readonly tokenProgram: string;
}

export interface BlockMintInput extends EscrowMintInput {
    readonly rentRecipient?: string;
}

export interface EscrowInput {
    readonly escrow: string;
}

export interface AddTimelockInput extends EscrowInput {
    readonly lockDuration: bigint;
}

export interface SetHookInput extends EscrowInput {
    readonly hookProgram: string;
}

export interface TokenExtensionInput extends EscrowInput {
    readonly extensionType: number;
}

function asAddress(value: string): Address {
    return address(value.trim());
}

function getProgramAddress(value: string): Address {
    return address(value.trim());
}

function createTransactionId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeValues(values?: RecentTransactionValues): RecentTransactionValues | undefined {
    if (!values) return undefined;
    const entries = Object.entries(values as Record<string, string | undefined>)
        .map(([key, value]) => [key, value?.trim() ?? ''] as const)
        .filter(([, value]) => value.length > 0);
    if (entries.length === 0) return undefined;
    return Object.fromEntries(entries);
}

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

export function useEscrowMutations() {
    const rpc = useRpc();
    const signAndSend = useWalletTransactionSignAndSend();
    const { addRecentTransaction } = useRecentTransactions();
    const { programId } = useProgramContext();
    const { createSigner } = useWallet();
    const queryClient = useQueryClient();
    const transactionToast = useTransactionToast();

    function requireSigner(): TransactionSigner {
        const signer = createSigner();
        if (!signer) throw new Error('Wallet not connected');
        return signer;
    }

    async function sendEscrowTransaction(
        instructions: readonly Instruction[],
        txSigner: TransactionSigner,
        action: string,
        values?: RecentTransactionValues,
    ): Promise<string> {
        const normalizedValues = normalizeValues(values);
        const id = createTransactionId();

        try {
            const signature = await signAndSend(instructions, txSigner);
            addRecentTransaction({
                action,
                id,
                signature,
                status: 'success',
                timestamp: Date.now(),
                values: normalizedValues,
            });
            return signature;
        } catch (error) {
            const message = formatTransactionError(error);
            addRecentTransaction({
                action,
                error: message,
                id,
                signature: null,
                status: 'failed',
                timestamp: Date.now(),
                values: normalizedValues,
            });
            throw new Error(message, { cause: error });
        }
    }

    function onSuccess(result: EscrowMutationResult) {
        transactionToast.onSuccess(result.signature);
        invalidateWithDelay(queryClient, [['escrow']]);
    }

    function onError(error: unknown) {
        transactionToast.onError(error);
    }

    const createEscrow = useMutation({
        mutationFn: async (): Promise<CreateEscrowMutationResult> => {
            const txSigner = requireSigner();
            const programAddress = getProgramAddress(programId);
            const escrowSeed = await generateKeyPairSigner();
            const [escrow] = await findEscrowPda({ escrowSeed: escrowSeed.address }, { programAddress });

            const instruction = await getCreatesEscrowInstructionAsync(
                {
                    admin: txSigner,
                    escrowSeed,
                    payer: txSigner,
                },
                { programAddress },
            );

            const signature = await sendEscrowTransaction([instruction], txSigner, 'Create Escrow', { escrow });
            return { escrow, seed: escrowSeed.address, signature };
        },
        onError,
        onSuccess,
    });

    const deposit = useMutation({
        mutationFn: async (input: DepositInput): Promise<DepositMutationResult> => {
            const txSigner = requireSigner();
            const programAddress = getProgramAddress(programId);
            const escrow = input.escrow.trim();
            const mint = input.mint.trim();
            const tokenProgram = normalizeTokenProgram(input.tokenProgram);
            const receiptSeed = await generateKeyPairSigner();
            const [receipt] = await findReceiptPda(
                {
                    depositor: txSigner.address,
                    escrow: asAddress(escrow),
                    mint: asAddress(mint),
                    receiptSeed: receiptSeed.address,
                },
                { programAddress },
            );

            const instruction = await getDepositInstructionAsync(
                {
                    amount: input.amount,
                    depositor: txSigner,
                    escrow: asAddress(escrow),
                    mint: asAddress(mint),
                    payer: txSigner,
                    receiptSeed,
                    tokenProgram,
                },
                { programAddress },
            );

            const signature = await sendEscrowTransaction([instruction], txSigner, 'Deposit', {
                amount: String(input.amount),
                escrow,
                mint,
                receipt,
                tokenProgram: tokenProgram.toString(),
            });
            return { amount: input.amount, escrow, mint, receipt, receiptSeed: receiptSeed.address, signature };
        },
        onError,
        onSuccess,
    });

    const withdraw = useMutation({
        mutationFn: async (input: WithdrawInput): Promise<EscrowMutationResult> => {
            const txSigner = requireSigner();
            const programAddress = getProgramAddress(programId);
            const escrow = input.escrow.trim();
            const mint = input.mint.trim();
            const receipt = input.receipt.trim();
            const rentRecipient = input.rentRecipient?.trim() || txSigner.address;
            const tokenProgram = normalizeTokenProgram(input.tokenProgram);
            const [extensionsPda] = await findExtensionsPda({ escrow: asAddress(escrow) }, { programAddress });
            const extensionsAccount = await fetchEncodedAccount(rpc, extensionsPda);
            const remainingAccounts: (AccountMeta | AccountSignerMeta)[] = [];

            if (extensionsAccount.exists) {
                const { arbiter, hookProgram } = parseExtensions(new Uint8Array(extensionsAccount.data));
                if (arbiter) {
                    remainingAccounts.push(
                        arbiter === txSigner.address
                            ? { address: arbiter, role: AccountRole.READONLY_SIGNER, signer: txSigner }
                            : { address: arbiter, role: AccountRole.READONLY_SIGNER },
                    );
                }
                if (hookProgram) remainingAccounts.push({ address: hookProgram, role: AccountRole.READONLY });
            }

            const instruction = await getWithdrawInstructionAsync(
                {
                    escrow: asAddress(escrow),
                    mint: asAddress(mint),
                    receipt: asAddress(receipt),
                    rentRecipient: asAddress(rentRecipient),
                    tokenProgram,
                    withdrawer: txSigner,
                },
                { programAddress },
            );
            const finalInstruction: Instruction =
                remainingAccounts.length > 0
                    ? { ...instruction, accounts: [...instruction.accounts, ...remainingAccounts] }
                    : instruction;

            const signature = await sendEscrowTransaction([finalInstruction], txSigner, 'Withdraw', {
                escrow,
                mint,
                receipt,
                rentRecipient,
                tokenProgram: tokenProgram.toString(),
            });
            return { signature };
        },
        onError,
        onSuccess,
    });

    const allowMint = useMutation({
        mutationFn: async (input: EscrowMintInput): Promise<EscrowMutationResult> => {
            const txSigner = requireSigner();
            const programAddress = getProgramAddress(programId);
            const escrow = input.escrow.trim();
            const mint = input.mint.trim();
            const tokenProgram = normalizeTokenProgram(input.tokenProgram);
            const instruction = await getAllowMintInstructionAsync(
                {
                    admin: txSigner,
                    escrow: asAddress(escrow),
                    mint: asAddress(mint),
                    payer: txSigner,
                    tokenProgram,
                },
                { programAddress },
            );
            const signature = await sendEscrowTransaction([instruction], txSigner, 'Allow Mint', {
                escrow,
                mint,
                tokenProgram: tokenProgram.toString(),
            });
            return { signature };
        },
        onError,
        onSuccess,
    });

    const blockMint = useMutation({
        mutationFn: async (input: BlockMintInput): Promise<EscrowMutationResult> => {
            const txSigner = requireSigner();
            const programAddress = getProgramAddress(programId);
            const escrow = input.escrow.trim();
            const mint = input.mint.trim();
            const rentRecipient = input.rentRecipient?.trim() || txSigner.address;
            const tokenProgram = normalizeTokenProgram(input.tokenProgram);
            const instruction = await getBlockMintInstructionAsync(
                {
                    admin: txSigner,
                    escrow: asAddress(escrow),
                    mint: asAddress(mint),
                    rentRecipient: asAddress(rentRecipient),
                    tokenProgram,
                },
                { programAddress },
            );
            const signature = await sendEscrowTransaction([instruction], txSigner, 'Block Mint', {
                escrow,
                mint,
                rentRecipient,
                tokenProgram: tokenProgram.toString(),
            });
            return { signature };
        },
        onError,
        onSuccess,
    });

    const setImmutable = useMutation({
        mutationFn: async (input: EscrowInput): Promise<EscrowMutationResult> => {
            const txSigner = requireSigner();
            const programAddress = getProgramAddress(programId);
            const escrow = input.escrow.trim();
            const instruction = getSetImmutableInstruction(
                {
                    admin: txSigner,
                    escrow: asAddress(escrow),
                },
                { programAddress },
            );
            const signature = await sendEscrowTransaction([instruction], txSigner, 'Set Immutable', { escrow });
            return { signature };
        },
        onError,
        onSuccess,
    });

    const addTimelock = useMutation({
        mutationFn: async (input: AddTimelockInput): Promise<EscrowMutationResult> => {
            const txSigner = requireSigner();
            const programAddress = getProgramAddress(programId);
            const escrow = input.escrow.trim();
            const instruction = await getAddTimelockInstructionAsync(
                {
                    admin: txSigner,
                    escrow: asAddress(escrow),
                    lockDuration: input.lockDuration,
                    payer: txSigner,
                },
                { programAddress },
            );
            const signature = await sendEscrowTransaction([instruction], txSigner, 'Add Timelock', {
                escrow,
                lockDuration: String(input.lockDuration),
            });
            return { signature };
        },
        onError,
        onSuccess,
    });

    const setHook = useMutation({
        mutationFn: async (input: SetHookInput): Promise<EscrowMutationResult> => {
            const txSigner = requireSigner();
            const programAddress = getProgramAddress(programId);
            const escrow = input.escrow.trim();
            const hookProgram = input.hookProgram.trim();
            const instruction = await getSetHookInstructionAsync(
                {
                    admin: txSigner,
                    escrow: asAddress(escrow),
                    hookProgram: asAddress(hookProgram),
                    payer: txSigner,
                },
                { programAddress },
            );
            const signature = await sendEscrowTransaction([instruction], txSigner, 'Set Hook', {
                escrow,
                hookProgram,
            });
            return { signature };
        },
        onError,
        onSuccess,
    });

    const setArbiter = useMutation({
        mutationFn: async (input: EscrowInput): Promise<EscrowMutationResult> => {
            const txSigner = requireSigner();
            const programAddress = getProgramAddress(programId);
            const escrow = input.escrow.trim();
            const [, extensionsBump] = await findExtensionsPda({ escrow: asAddress(escrow) }, { programAddress });
            const instruction = await getSetArbiterInstructionAsync(
                {
                    admin: txSigner,
                    arbiter: txSigner,
                    escrow: asAddress(escrow),
                    extensionsBump,
                    payer: txSigner,
                },
                { programAddress },
            );
            const signature = await sendEscrowTransaction([instruction], txSigner, 'Set Arbiter', { escrow });
            return { signature };
        },
        onError,
        onSuccess,
    });

    const blockTokenExtension = useMutation({
        mutationFn: async (input: TokenExtensionInput): Promise<EscrowMutationResult> => {
            const txSigner = requireSigner();
            const programAddress = getProgramAddress(programId);
            const escrow = input.escrow.trim();
            const [, extensionsBump] = await findExtensionsPda({ escrow: asAddress(escrow) }, { programAddress });
            const instruction = await getBlockTokenExtensionInstructionAsync(
                {
                    admin: txSigner,
                    blockedExtension: input.extensionType,
                    escrow: asAddress(escrow),
                    extensionsBump,
                    payer: txSigner,
                },
                { programAddress },
            );
            const signature = await sendEscrowTransaction([instruction], txSigner, 'Block Token Extension', {
                escrow,
                extensionType: String(input.extensionType),
            });
            return { signature };
        },
        onError,
        onSuccess,
    });

    const unblockTokenExtension = useMutation({
        mutationFn: async (input: TokenExtensionInput): Promise<EscrowMutationResult> => {
            const txSigner = requireSigner();
            const programAddress = getProgramAddress(programId);
            const escrow = input.escrow.trim();
            const instruction = await getUnblockTokenExtensionInstructionAsync(
                {
                    admin: txSigner,
                    blockedExtension: input.extensionType,
                    escrow: asAddress(escrow),
                    payer: txSigner,
                },
                { programAddress },
            );
            const signature = await sendEscrowTransaction([instruction], txSigner, 'Unblock Token Extension', {
                escrow,
                extensionType: String(input.extensionType),
            });
            return { signature };
        },
        onError,
        onSuccess,
    });

    const removeExtension = useMutation({
        mutationFn: async (input: TokenExtensionInput): Promise<EscrowMutationResult> => {
            const txSigner = requireSigner();
            const programAddress = getProgramAddress(programId);
            const escrow = input.escrow.trim();
            const instruction = await getRemoveExtensionInstructionAsync(
                {
                    admin: txSigner,
                    escrow: asAddress(escrow),
                    extensionType: input.extensionType,
                    payer: txSigner,
                },
                { programAddress },
            );
            const signature = await sendEscrowTransaction([instruction], txSigner, 'Remove Extension', {
                escrow,
                extensionType: String(input.extensionType),
            });
            return { signature };
        },
        onError,
        onSuccess,
    });

    return {
        addTimelock,
        allowMint,
        blockMint,
        blockTokenExtension,
        createEscrow,
        deposit,
        removeExtension,
        setArbiter,
        setHook,
        setImmutable,
        unblockTokenExtension,
        withdraw,
    };
}
