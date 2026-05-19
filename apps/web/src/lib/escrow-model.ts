import type { Account, Address, Rpc, SolanaRpcApi } from '@solana/kit';
import type { AllowedMint, Escrow, Receipt } from '@solana/escrow';

export type EscrowRpc = Rpc<SolanaRpcApi>;

export type EscrowExtensionKind = 'arbiter' | 'blocked-token-extensions' | 'hook' | 'timelock' | 'unknown';

export interface EscrowRecord {
    readonly address: Address;
    readonly admin: Address;
    readonly bump: number;
    readonly escrowSeed: Address;
    readonly isImmutable: boolean;
    readonly version: number;
}

export interface ReceiptRecord {
    readonly address: Address;
    readonly amount: bigint;
    readonly bump: number;
    readonly depositedAt: bigint;
    readonly depositor: Address;
    readonly escrow: Address;
    readonly mint: Address;
    readonly receiptSeed: Address;
    readonly version: number;
}

export interface AllowedMintRecord {
    readonly address: Address;
    readonly bump: number;
    readonly escrow: Address;
    readonly mint: Address;
    readonly version: number;
}

export interface EscrowExtensionRecord {
    readonly kind: EscrowExtensionKind;
    readonly rawType: number;
}

export interface TimelockExtensionRecord extends EscrowExtensionRecord {
    readonly enabled: boolean;
    readonly kind: 'timelock';
    readonly lockDuration: bigint;
}

export interface HookExtensionRecord extends EscrowExtensionRecord {
    readonly hookProgram: Address;
    readonly kind: 'hook';
}

export interface ArbiterExtensionRecord extends EscrowExtensionRecord {
    readonly arbiter: Address;
    readonly kind: 'arbiter';
}

export interface BlockedTokenExtensionsRecord extends EscrowExtensionRecord {
    readonly blockedExtensions: readonly number[];
    readonly kind: 'blocked-token-extensions';
}

export interface UnknownExtensionRecord extends EscrowExtensionRecord {
    readonly kind: 'unknown';
    readonly length: number;
}

export type ParsedEscrowExtension =
    | ArbiterExtensionRecord
    | BlockedTokenExtensionsRecord
    | HookExtensionRecord
    | TimelockExtensionRecord
    | UnknownExtensionRecord;

export interface EscrowExtensionsRecord {
    readonly address: Address;
    readonly arbiter: Address | null;
    readonly blockedTokenExtensions: readonly number[];
    readonly bump: number;
    readonly escrow: Address;
    readonly extensionCount: number;
    readonly extensions: readonly ParsedEscrowExtension[];
    readonly hookProgram: Address | null;
    readonly lockDuration: bigint | null;
}

export interface EscrowDashboardData {
    readonly adminEscrows: readonly EscrowRecord[];
    readonly allowedMints: readonly AllowedMintRecord[];
    readonly depositorReceipts: readonly ReceiptRecord[];
    readonly escrowReceipts: readonly ReceiptRecord[];
    readonly extensions: ReadonlyMap<Address, EscrowExtensionsRecord>;
}

export function escrowAccountToRecord(account: Account<Escrow>): EscrowRecord {
    return {
        address: account.address,
        admin: account.data.admin,
        bump: account.data.bump,
        escrowSeed: account.data.escrowSeed,
        isImmutable: account.data.isImmutable,
        version: account.data.version,
    };
}

export function receiptAccountToRecord(account: Account<Receipt>): ReceiptRecord {
    return {
        address: account.address,
        amount: account.data.amount,
        bump: account.data.bump,
        depositedAt: account.data.depositedAt,
        depositor: account.data.depositor,
        escrow: account.data.escrow,
        mint: account.data.mint,
        receiptSeed: account.data.receiptSeed,
        version: account.data.version,
    };
}

export function allowedMintAccountToRecord(
    account: Account<AllowedMint>,
    escrow: Address,
    mint: Address,
): AllowedMintRecord {
    return {
        address: account.address,
        bump: account.data.bump,
        escrow,
        mint,
        version: account.data.version,
    };
}

export function formatTokenAmount(value: bigint): string {
    return new Intl.NumberFormat('en-US').format(value);
}

export function formatAddress(value: string, size = 4): string {
    if (value.length <= size * 2 + 2) return value;
    return `${value.slice(0, size)}..${value.slice(-size)}`;
}

export function receiptUnlockTimestamp(
    receipt: ReceiptRecord,
    extensions: EscrowExtensionsRecord | null,
): bigint | null {
    if (!extensions?.lockDuration || extensions.lockDuration === 0n) return null;
    return receipt.depositedAt + extensions.lockDuration;
}

export function isReceiptWithdrawable(
    receipt: ReceiptRecord,
    extensions: EscrowExtensionsRecord | null,
    now = BigInt(Math.floor(Date.now() / 1000)),
): boolean {
    const unlockTimestamp = receiptUnlockTimestamp(receipt, extensions);
    return unlockTimestamp === null || now >= unlockTimestamp;
}
