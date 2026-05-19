import {
    decodeEscrow,
    decodeReceipt,
    fetchMaybeAllowedMintFromSeeds,
    findExtensionsPda,
    type Escrow,
    type Receipt,
} from '@solana/escrow';
import {
    fetchEncodedAccount,
    getAddressDecoder,
    getBase64Encoder,
    type Account,
    type Address,
    type Base58EncodedBytes,
    type Base64EncodedBytes,
    type EncodedAccount,
    type Lamports,
} from '@solana/kit';

import {
    allowedMintAccountToRecord,
    escrowAccountToRecord,
    receiptAccountToRecord,
    type AllowedMintRecord,
    type EscrowDashboardData,
    type EscrowExtensionsRecord,
    type EscrowRecord,
    type EscrowRpc,
    type ParsedEscrowExtension,
    type ReceiptRecord,
} from '@/lib/escrow-model';

const DISCRIMINATOR_OFFSET = 0n;
const ESCROW_ADMIN_OFFSET = 35n;
const RECEIPT_ESCROW_OFFSET = 10n;
const RECEIPT_DEPOSITOR_OFFSET = 42n;

const ESCROW_SIZE = 68n;
const RECEIPT_SIZE = 154n;

const ESCROW_DISCRIMINATOR = 'AQ==' as Base64EncodedBytes;
const RECEIPT_DISCRIMINATOR = 'Aw==' as Base64EncodedBytes;

const EXTENSIONS_HEADER_SIZE = 4;
const TLV_HEADER_SIZE = 4;

const EXTENSION_TYPE_TIMELOCK = 0;
const EXTENSION_TYPE_HOOK = 1;
const EXTENSION_TYPE_BLOCKED_TOKEN_EXTENSIONS = 2;
const EXTENSION_TYPE_ARBITER = 3;

const base64Encoder = getBase64Encoder();
const addressDecoder = getAddressDecoder();

interface Base64ProgramAccount {
    account: {
        data: readonly [Base64EncodedBytes, 'base64'];
        executable: boolean;
        lamports: Lamports;
        owner: Address;
        space: bigint;
    };
    pubkey: Address;
}

function addressBytes(address: Address): Base58EncodedBytes {
    return address as unknown as Base58EncodedBytes;
}

function toEncodedAccount(account: Base64ProgramAccount): EncodedAccount {
    const [base64Data] = account.account.data;
    return {
        address: account.pubkey,
        data: base64Encoder.encode(base64Data),
        executable: account.account.executable,
        lamports: account.account.lamports,
        programAddress: account.account.owner,
        space: account.account.space,
    };
}

function uniqueAddresses(addresses: readonly Address[]): Address[] {
    return [...new Set(addresses)].sort((a, b) => a.localeCompare(b));
}

function readU64LE(data: Uint8Array): bigint {
    let value = 0n;
    for (let index = 0; index < Math.min(data.length, 8); index += 1) {
        value |= BigInt(data[index]) << (BigInt(index) * 8n);
    }
    return value;
}

function readU16LE(data: Uint8Array, offset: number): number {
    return data[offset] | (data[offset + 1] << 8);
}

function parseBlockedTokenExtensions(data: Uint8Array): readonly number[] {
    if (data.length === 0) return [];
    const count = data[0];
    const extensions: number[] = [];
    for (let index = 0; index < count; index += 1) {
        const offset = 1 + index * 2;
        if (offset + 2 > data.length) break;
        extensions.push(readU16LE(data, offset));
    }
    return extensions;
}

function parseExtension(rawType: number, data: Uint8Array): ParsedEscrowExtension {
    if (rawType === EXTENSION_TYPE_TIMELOCK) {
        const lockDuration = readU64LE(data);
        return {
            enabled: lockDuration !== 0n,
            kind: 'timelock',
            lockDuration,
            rawType,
        };
    }

    if (rawType === EXTENSION_TYPE_HOOK && data.length >= 32) {
        return {
            hookProgram: addressDecoder.decode(data.slice(0, 32)),
            kind: 'hook',
            rawType,
        };
    }

    if (rawType === EXTENSION_TYPE_BLOCKED_TOKEN_EXTENSIONS) {
        return {
            blockedExtensions: parseBlockedTokenExtensions(data),
            kind: 'blocked-token-extensions',
            rawType,
        };
    }

    if (rawType === EXTENSION_TYPE_ARBITER && data.length >= 32) {
        return {
            arbiter: addressDecoder.decode(data.slice(0, 32)),
            kind: 'arbiter',
            rawType,
        };
    }

    return {
        kind: 'unknown',
        length: data.length,
        rawType,
    };
}

function parseExtensionsAccount(escrow: Address, address: Address, data: Uint8Array): EscrowExtensionsRecord {
    const bump = data[2] ?? 0;
    const extensionCount = data[3] ?? 0;
    const extensions: ParsedEscrowExtension[] = [];
    let offset = EXTENSIONS_HEADER_SIZE;

    while (offset + TLV_HEADER_SIZE <= data.length) {
        const rawType = readU16LE(data, offset);
        const length = readU16LE(data, offset + 2);
        const start = offset + TLV_HEADER_SIZE;
        const end = start + length;
        if (end > data.length) break;

        extensions.push(parseExtension(rawType, data.slice(start, end)));
        offset = end;
    }

    const timelock = extensions.find(extension => extension.kind === 'timelock');
    const hook = extensions.find(extension => extension.kind === 'hook');
    const arbiter = extensions.find(extension => extension.kind === 'arbiter');
    const blockedTokenExtensions = extensions.find(extension => extension.kind === 'blocked-token-extensions');

    return {
        address,
        arbiter: arbiter?.kind === 'arbiter' ? arbiter.arbiter : null,
        blockedTokenExtensions:
            blockedTokenExtensions?.kind === 'blocked-token-extensions' ? blockedTokenExtensions.blockedExtensions : [],
        bump,
        escrow,
        extensionCount,
        extensions,
        hookProgram: hook?.kind === 'hook' ? hook.hookProgram : null,
        lockDuration: timelock?.kind === 'timelock' ? timelock.lockDuration : null,
    };
}

function sortEscrows(records: readonly EscrowRecord[]): EscrowRecord[] {
    return [...records].sort((a, b) => a.address.localeCompare(b.address));
}

function sortReceipts(records: readonly ReceiptRecord[]): ReceiptRecord[] {
    return [...records].sort((a, b) => {
        if (a.depositedAt === b.depositedAt) return a.address.localeCompare(b.address);
        return a.depositedAt > b.depositedAt ? -1 : 1;
    });
}

function sortAllowedMints(records: readonly AllowedMintRecord[]): AllowedMintRecord[] {
    return [...records].sort((a, b) => a.escrow.localeCompare(b.escrow) || a.mint.localeCompare(b.mint));
}

async function fetchEscrowAccountsByFilter(
    rpc: EscrowRpc,
    programAddress: Address,
    filter: { bytes: Base58EncodedBytes; offset: bigint },
): Promise<Account<Escrow>[]> {
    const accounts = await rpc
        .getProgramAccounts(programAddress, {
            encoding: 'base64',
            filters: [
                { dataSize: ESCROW_SIZE },
                {
                    memcmp: {
                        bytes: ESCROW_DISCRIMINATOR,
                        encoding: 'base64',
                        offset: DISCRIMINATOR_OFFSET,
                    },
                },
                {
                    memcmp: {
                        bytes: filter.bytes,
                        encoding: 'base58',
                        offset: filter.offset,
                    },
                },
            ],
        })
        .send();

    return accounts.map(account => decodeEscrow(toEncodedAccount(account)));
}

async function fetchReceiptAccountsByFilter(
    rpc: EscrowRpc,
    programAddress: Address,
    filter: { bytes: Base58EncodedBytes; offset: bigint },
): Promise<Account<Receipt>[]> {
    const accounts = await rpc
        .getProgramAccounts(programAddress, {
            encoding: 'base64',
            filters: [
                { dataSize: RECEIPT_SIZE },
                {
                    memcmp: {
                        bytes: RECEIPT_DISCRIMINATOR,
                        encoding: 'base64',
                        offset: DISCRIMINATOR_OFFSET,
                    },
                },
                {
                    memcmp: {
                        bytes: filter.bytes,
                        encoding: 'base58',
                        offset: filter.offset,
                    },
                },
            ],
        })
        .send();

    return accounts.map(account => decodeReceipt(toEncodedAccount(account)));
}

export async function fetchAdminEscrows(
    rpc: EscrowRpc,
    admin: Address,
    programAddress: Address,
): Promise<EscrowRecord[]> {
    const accounts = await fetchEscrowAccountsByFilter(rpc, programAddress, {
        bytes: addressBytes(admin),
        offset: ESCROW_ADMIN_OFFSET,
    });
    return sortEscrows(accounts.map(escrowAccountToRecord));
}

export async function fetchDepositorReceipts(
    rpc: EscrowRpc,
    depositor: Address,
    programAddress: Address,
): Promise<ReceiptRecord[]> {
    const accounts = await fetchReceiptAccountsByFilter(rpc, programAddress, {
        bytes: addressBytes(depositor),
        offset: RECEIPT_DEPOSITOR_OFFSET,
    });
    return sortReceipts(accounts.map(receiptAccountToRecord));
}

export async function fetchEscrowReceipts(
    rpc: EscrowRpc,
    escrow: Address,
    programAddress: Address,
): Promise<ReceiptRecord[]> {
    const accounts = await fetchReceiptAccountsByFilter(rpc, programAddress, {
        bytes: addressBytes(escrow),
        offset: RECEIPT_ESCROW_OFFSET,
    });
    return sortReceipts(accounts.map(receiptAccountToRecord));
}

export async function fetchEscrowExtensions(
    rpc: EscrowRpc,
    escrow: Address,
    programAddress: Address,
): Promise<EscrowExtensionsRecord | null> {
    const [extensionsAddress] = await findExtensionsPda({ escrow }, { programAddress });
    const account = await fetchEncodedAccount(rpc, extensionsAddress);
    if (!account.exists) return null;
    return parseExtensionsAccount(escrow, account.address, new Uint8Array(account.data));
}

export async function fetchKnownAllowedMints(
    rpc: EscrowRpc,
    escrows: readonly Address[],
    mints: readonly Address[],
    programAddress: Address,
): Promise<AllowedMintRecord[]> {
    const pairs = uniqueAddresses(escrows).flatMap(escrow =>
        uniqueAddresses(mints).map(mint => ({
            escrow,
            mint,
        })),
    );
    if (pairs.length === 0) return [];

    const accounts = await Promise.all(
        pairs.map(async pair => {
            const account = await fetchMaybeAllowedMintFromSeeds(rpc, pair, { programAddress });
            return account.exists ? allowedMintAccountToRecord(account, pair.escrow, pair.mint) : null;
        }),
    );

    return sortAllowedMints(accounts.filter((account): account is AllowedMintRecord => account !== null));
}

export async function fetchEscrowDashboardData(
    rpc: EscrowRpc,
    wallet: Address,
    programAddress: Address,
    knownMints: readonly Address[] = [],
): Promise<EscrowDashboardData> {
    const [adminEscrows, depositorReceipts] = await Promise.all([
        fetchAdminEscrows(rpc, wallet, programAddress),
        fetchDepositorReceipts(rpc, wallet, programAddress),
    ]);

    const escrowAddresses = uniqueAddresses([
        ...adminEscrows.map(escrow => escrow.address),
        ...depositorReceipts.map(receipt => receipt.escrow),
    ]);
    const receiptMints = uniqueAddresses(depositorReceipts.map(receipt => receipt.mint));
    const mints = uniqueAddresses([...knownMints, ...receiptMints]);

    const [extensionRecords, escrowReceiptGroups, allowedMints] = await Promise.all([
        Promise.all(escrowAddresses.map(escrow => fetchEscrowExtensions(rpc, escrow, programAddress))),
        Promise.all(escrowAddresses.map(escrow => fetchEscrowReceipts(rpc, escrow, programAddress))),
        fetchKnownAllowedMints(rpc, escrowAddresses, mints, programAddress),
    ]);

    const extensions = new Map<Address, EscrowExtensionsRecord>();
    for (const record of extensionRecords) {
        if (record) extensions.set(record.escrow, record);
    }

    return {
        adminEscrows,
        allowedMints,
        depositorReceipts,
        escrowReceipts: sortReceipts(escrowReceiptGroups.flat()),
        extensions,
    };
}
