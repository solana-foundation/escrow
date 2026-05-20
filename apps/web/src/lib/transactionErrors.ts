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
import {
    isSolanaError,
    SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
    SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
    unwrapSimulationError,
} from '@solana/kit';

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
const MAX_LOG_LINES = 12;

export interface TransactionErrorDetails {
    readonly logs: readonly string[];
    readonly message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (isRecord(error) && typeof error.message === 'string') return error.message;
    return '';
}

function getErrorCause(error: unknown): unknown {
    if (error instanceof Error) return error.cause;
    if (isRecord(error)) return error.cause;
    return undefined;
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

function parseInstructionErrorCode(value: unknown): number | null {
    if (!Array.isArray(value) || value.length < 2) return null;

    const instructionError = value[1];
    if (isRecord(instructionError) && typeof instructionError.Custom === 'number') return instructionError.Custom;
    return null;
}

function parseCustomProgramCode(error: unknown, visited = new Set<object>()): number | null {
    if (isRecord(error)) {
        if (visited.has(error)) return null;
        visited.add(error);
    }

    const simulationCause = unwrapSimulationError(error);
    if (simulationCause !== error) {
        const simulationCode = parseCustomProgramCode(simulationCause, visited);
        if (simulationCode !== null) return simulationCode;
    }

    if (isSolanaError(error, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) {
        return error.context.code;
    }

    if (isRecord(error)) {
        const context = error.context;
        if (isRecord(context) && typeof context.code === 'number') return context.code;

        const directInstructionErrorCode = parseInstructionErrorCode(error.InstructionError);
        if (directInstructionErrorCode !== null) return directInstructionErrorCode;

        const err = error.err;
        if (isRecord(err)) {
            const errInstructionErrorCode = parseInstructionErrorCode(err.InstructionError);
            if (errInstructionErrorCode !== null) return errInstructionErrorCode;
        }

        const data = error.data;
        if (isRecord(data)) {
            const dataInstructionErrorCode = parseCustomProgramCode(data, visited);
            if (dataInstructionErrorCode !== null) return dataInstructionErrorCode;
        }
    }

    const message = getErrorMessage(error);
    const parsedMessageCode = message ? parseCustomProgramCodeFromString(message) : null;
    if (parsedMessageCode !== null) return parsedMessageCode;

    const cause = getErrorCause(error);
    return cause === undefined ? null : parseCustomProgramCode(cause, visited);
}

function getEscrowProgramErrorMessage(code: number | null): string | null {
    if (code === null) return null;
    return ESCROW_PROGRAM_ERROR_MESSAGES[code] ?? null;
}

function normalizeLogs(value: unknown): readonly string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((line): line is string => typeof line === 'string' && line.trim().length > 0);
}

function collectLogs(error: unknown, visited = new Set<object>()): readonly string[] {
    const logs: string[] = [];

    if (isRecord(error)) {
        if (visited.has(error)) return [];
        visited.add(error);

        if (isSolanaError(error, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE)) {
            logs.push(...normalizeLogs(error.context.logs));
        }

        logs.push(...normalizeLogs(error.logs));

        const context = error.context;
        if (isRecord(context)) logs.push(...normalizeLogs(context.logs));

        const data = error.data;
        if (isRecord(data)) logs.push(...normalizeLogs(data.logs));
    }

    const simulationCause = unwrapSimulationError(error);
    if (simulationCause !== error) logs.push(...collectLogs(simulationCause, visited));

    const cause = getErrorCause(error);
    if (cause !== undefined) logs.push(...collectLogs(cause, visited));

    return [...new Set(logs)];
}

function isPreflightFailure(error: unknown, visited = new Set<object>()): boolean {
    if (isRecord(error)) {
        if (visited.has(error)) return false;
        visited.add(error);
    }

    if (isSolanaError(error, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE)) {
        return true;
    }

    const cause = getErrorCause(error);
    return cause === undefined ? false : isPreflightFailure(cause, visited);
}

export function getTransactionErrorDetails(error: unknown): TransactionErrorDetails {
    const message = getErrorMessage(error).trim();
    const escrowMessage = getEscrowProgramErrorMessage(parseCustomProgramCode(error));

    if (escrowMessage) {
        return {
            logs: collectLogs(error),
            message: `${FALLBACK_TX_FAILED_MESSAGE}: ${escrowMessage}`,
        };
    }

    if (/user rejected|rejected the request|declined|cancelled/i.test(message)) {
        return {
            logs: [],
            message: 'Transaction was rejected in wallet',
        };
    }

    if (/request.*pending|already pending/i.test(message)) {
        return {
            logs: [],
            message: `${FALLBACK_TX_FAILED_MESSAGE}: request is already pending in your wallet`,
        };
    }

    if (isPreflightFailure(error)) {
        return {
            logs: collectLogs(error),
            message: `${FALLBACK_TX_FAILED_MESSAGE}: transaction simulation failed`,
        };
    }

    if (
        message === FALLBACK_TX_FAILED_MESSAGE ||
        message.startsWith(`${FALLBACK_TX_FAILED_MESSAGE}:`) ||
        message === 'Transaction was rejected in wallet'
    ) {
        return {
            logs: collectLogs(error),
            message,
        };
    }

    return {
        logs: collectLogs(error),
        message: message ? `${FALLBACK_TX_FAILED_MESSAGE}: ${message}` : FALLBACK_TX_FAILED_MESSAGE,
    };
}

export function formatTransactionError(error: unknown): string {
    return getTransactionErrorDetails(error).message;
}

export function formatTransactionErrorWithLogs(error: unknown): string {
    const { logs, message } = getTransactionErrorDetails(error);
    if (logs.length === 0) return message;

    const visibleLogs = logs.slice(-MAX_LOG_LINES);
    const omittedCount = logs.length - visibleLogs.length;
    const omittedLine = omittedCount > 0 ? [`... ${omittedCount} earlier log lines omitted`] : [];

    return [message, '', 'Logs:', ...omittedLine, ...visibleLogs].join('\n');
}
