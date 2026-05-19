'use client';

import {
    ESCROW_PROGRAM_ERROR__ESCROW_IMMUTABLE,
    ESCROW_PROGRAM_ERROR__HOOK_PROGRAM_MISMATCH,
    ESCROW_PROGRAM_ERROR__HOOK_REJECTED,
    ESCROW_PROGRAM_ERROR__INVALID_ADMIN,
    ESCROW_PROGRAM_ERROR__INVALID_ARBITER,
    ESCROW_PROGRAM_ERROR__INVALID_ESCROW_ID,
    ESCROW_PROGRAM_ERROR__INVALID_EVENT_AUTHORITY,
    ESCROW_PROGRAM_ERROR__INVALID_RECEIPT_ESCROW,
    ESCROW_PROGRAM_ERROR__INVALID_WITHDRAWER,
    ESCROW_PROGRAM_ERROR__MINT_NOT_ALLOWED,
    ESCROW_PROGRAM_ERROR__NON_TRANSFERABLE_NOT_ALLOWED,
    ESCROW_PROGRAM_ERROR__PAUSABLE_NOT_ALLOWED,
    ESCROW_PROGRAM_ERROR__PERMANENT_DELEGATE_NOT_ALLOWED,
    ESCROW_PROGRAM_ERROR__TIMELOCK_NOT_EXPIRED,
    ESCROW_PROGRAM_ERROR__TOKEN_EXTENSION_ALREADY_BLOCKED,
    ESCROW_PROGRAM_ERROR__TOKEN_EXTENSION_NOT_BLOCKED,
    ESCROW_PROGRAM_ERROR__ZERO_DEPOSIT_AMOUNT,
} from '@solana/escrow';

const ESCROW_PROGRAM_ERROR_MESSAGES: Record<number, string> = {
    [ESCROW_PROGRAM_ERROR__INVALID_ESCROW_ID]: 'Escrow ID invalid or does not respect rules',
    [ESCROW_PROGRAM_ERROR__INVALID_ADMIN]: 'Admin invalid or does not match escrow admin',
    [ESCROW_PROGRAM_ERROR__INVALID_EVENT_AUTHORITY]: 'Event authority PDA is invalid',
    [ESCROW_PROGRAM_ERROR__TIMELOCK_NOT_EXPIRED]: 'Timelock has not expired yet',
    [ESCROW_PROGRAM_ERROR__HOOK_REJECTED]: 'External hook rejected the operation',
    [ESCROW_PROGRAM_ERROR__INVALID_WITHDRAWER]: 'Withdrawer does not match receipt depositor',
    [ESCROW_PROGRAM_ERROR__INVALID_RECEIPT_ESCROW]: 'Receipt escrow does not match escrow',
    [ESCROW_PROGRAM_ERROR__HOOK_PROGRAM_MISMATCH]: 'Hook program mismatch',
    [ESCROW_PROGRAM_ERROR__MINT_NOT_ALLOWED]: 'Mint is not allowed for this escrow',
    [ESCROW_PROGRAM_ERROR__PERMANENT_DELEGATE_NOT_ALLOWED]: 'Mint has PermanentDelegate extension which is not allowed',
    [ESCROW_PROGRAM_ERROR__NON_TRANSFERABLE_NOT_ALLOWED]: 'Mint has NonTransferable extension which is not allowed',
    [ESCROW_PROGRAM_ERROR__PAUSABLE_NOT_ALLOWED]: 'Mint has Pausable extension which is not allowed',
    [ESCROW_PROGRAM_ERROR__TOKEN_EXTENSION_ALREADY_BLOCKED]: 'Token extension already blocked',
    [ESCROW_PROGRAM_ERROR__TOKEN_EXTENSION_NOT_BLOCKED]: 'Token extension is not currently blocked',
    [ESCROW_PROGRAM_ERROR__ZERO_DEPOSIT_AMOUNT]: 'Zero deposit amount',
    [ESCROW_PROGRAM_ERROR__INVALID_ARBITER]: 'Arbiter signer is missing or does not match',
    [ESCROW_PROGRAM_ERROR__ESCROW_IMMUTABLE]: 'Escrow is immutable and cannot be modified',
};

const FALLBACK_TX_FAILED_MESSAGE = 'Transaction failed';

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return '';
}

function tryDecodePayload(payload: string): string | null {
    if (typeof globalThis.atob !== 'function') {
        return null;
    }
    try {
        return globalThis.atob(payload);
    } catch {
        return null;
    }
}

function parseCustomProgramCodeFromString(message: string): number | null {
    const customErrorMatch = message.match(/custom program error:\s*(#\d+|0x[0-9a-fA-F]+|\d+)/i);
    if (customErrorMatch) {
        const value = customErrorMatch[1].trim();
        if (value.startsWith('#')) {
            const parsed = Number.parseInt(value.slice(1), 10);
            return Number.isNaN(parsed) ? null : parsed;
        }
        if (value.toLowerCase().startsWith('0x')) {
            const parsed = Number.parseInt(value.slice(2), 16);
            return Number.isNaN(parsed) ? null : parsed;
        }
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }

    const decodePayloadMatch = message.match(/@solana\/errors decode --\s+-?\d+\s+'([^']+)'/);
    if (decodePayloadMatch) {
        const decodedPayload = tryDecodePayload(decodePayloadMatch[1]);
        if (decodedPayload) {
            const params = new URLSearchParams(decodedPayload);
            const code = params.get('code');
            if (code) {
                const parsed = Number.parseInt(code, 10);
                if (!Number.isNaN(parsed)) {
                    return parsed;
                }
            }
        }
    }

    return null;
}

function parseCustomProgramCode(error: unknown): number | null {
    if (error && typeof error === 'object') {
        const withContext = error as { context?: { code?: unknown } };
        if (typeof withContext.context?.code === 'number') {
            return withContext.context.code;
        }
    }

    const message = getErrorMessage(error);
    if (!message) return null;
    return parseCustomProgramCodeFromString(message);
}

function getEscrowProgramErrorMessage(code: number | null): string | null {
    if (code === null) return null;
    return ESCROW_PROGRAM_ERROR_MESSAGES[code] ?? null;
}

export function formatTransactionError(error: unknown): string {
    const message = getErrorMessage(error);

    if (
        message === FALLBACK_TX_FAILED_MESSAGE ||
        message.startsWith(`${FALLBACK_TX_FAILED_MESSAGE}:`) ||
        message === 'Transaction was rejected in wallet'
    ) {
        return message;
    }

    const escrowMessage = getEscrowProgramErrorMessage(parseCustomProgramCode(error));
    if (escrowMessage) {
        return `${FALLBACK_TX_FAILED_MESSAGE}: ${escrowMessage}`;
    }

    if (message.includes('-32002')) {
        return `${FALLBACK_TX_FAILED_MESSAGE}: request is already pending in your wallet`;
    }

    if (/user rejected|rejected the request|declined|cancelled/i.test(message)) {
        return 'Transaction was rejected in wallet';
    }

    return FALLBACK_TX_FAILED_MESSAGE;
}
