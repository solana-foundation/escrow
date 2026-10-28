'use client';

import { isAddress } from '@solana/kit';

function normalize(value: string) {
    return value.trim();
}

export function validateAddress(value: string, label: string): string | null {
    const normalized = normalize(value);
    if (!normalized) return `${label} is required.`;
    return isAddress(normalized) ? null : `${label} is not a valid Solana address.`;
}

export function validateOptionalAddress(value: string, label: string): string | null {
    const normalized = normalize(value);
    if (!normalized) return null;
    return validateAddress(normalized, label);
}

export function validatePositiveInteger(value: string, label: string): string | null {
    const normalized = normalize(value);
    if (!normalized) return `${label} is required.`;
    if (!/^\d+$/.test(normalized)) return `${label} must be a whole number.`;
    try {
        const parsed = BigInt(normalized);
        if (parsed <= 0n) return `${label} must be greater than 0.`;
        return null;
    } catch {
        return `${label} is not a valid integer value.`;
    }
}

export function firstValidationError(...errors: Array<string | null>): string | null {
    return errors.find(Boolean) ?? null;
}
