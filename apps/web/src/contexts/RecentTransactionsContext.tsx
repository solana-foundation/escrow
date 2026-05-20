'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { formatTransactionError } from '@/lib/transactionErrors';

const STORAGE_KEY = 'escrow-ui-recent-transactions-v1';
const MAX_RECENT_TRANSACTIONS = 20;

export interface RecentTransactionValues {
    escrow?: string;
    mint?: string;
    receipt?: string;
    amount?: string;
    extensionType?: string;
    lockDuration?: string;
    hookProgram?: string;
    rentRecipient?: string;
    tokenProgram?: string;
}

export interface RecentTransaction {
    id: string;
    signature: string | null;
    action: string;
    timestamp: number;
    status: 'success' | 'failed';
    error?: string;
    values?: RecentTransactionValues;
}

interface RecentTransactionsContextType {
    recentTransactions: RecentTransaction[];
    addRecentTransaction: (transaction: RecentTransaction) => void;
    clearRecentTransactions: () => void;
}

const RecentTransactionsContext = createContext<RecentTransactionsContextType | null>(null);

function normalizeValues(values?: RecentTransactionValues): RecentTransactionValues | undefined {
    if (!values) return undefined;
    const normalizedEntries = (Object.entries(values) as [string, string | undefined][])
        .map(([key, value]) => [key, value?.trim() ?? ''] as const)
        .filter(([, value]) => value.length > 0);
    if (normalizedEntries.length === 0) return undefined;
    return Object.fromEntries(normalizedEntries);
}

function readStoredTransactions(): RecentTransaction[] {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return (parsed as Record<string, unknown>[])
            .filter(item => item !== null && typeof item === 'object')
            .map(item => ({
                id: String(
                    (item.id ?? item.signature ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`) as string,
                ),
                signature: item.signature ? String(item.signature as string) : null,
                action: String((item.action ?? 'Transaction') as string),
                timestamp: Number(item.timestamp ?? Date.now()),
                status: item.status === 'failed' ? ('failed' as const) : ('success' as const),
                error: item.error ? formatTransactionError(String(item.error as string)) : undefined,
                values: normalizeValues(item.values as RecentTransactionValues | undefined),
            }))
            .slice(0, MAX_RECENT_TRANSACTIONS);
    } catch {
        return [];
    }
}

export function RecentTransactionsProvider({ children }: { children: React.ReactNode }) {
    const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        setRecentTransactions(readStoredTransactions());
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recentTransactions));
    }, [hydrated, recentTransactions]);

    const addRecentTransaction = useCallback((transaction: RecentTransaction) => {
        setRecentTransactions(current => {
            const normalizedSignature = transaction.signature?.trim() || null;
            const normalized: RecentTransaction = {
                ...transaction,
                id: transaction.id.trim() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                signature: normalizedSignature,
                action: transaction.action.trim() || 'Transaction',
                status: transaction.status,
                error: transaction.error?.trim() ? formatTransactionError(transaction.error) : undefined,
                values: normalizeValues(transaction.values),
            };

            const deduped = current.filter(item =>
                normalized.signature ? item.signature !== normalized.signature : item.id !== normalized.id,
            );
            return [normalized, ...deduped].slice(0, MAX_RECENT_TRANSACTIONS);
        });
    }, []);

    const clearRecentTransactions = useCallback(() => {
        setRecentTransactions([]);
    }, []);

    const value = useMemo(
        () => ({
            recentTransactions,
            addRecentTransaction,
            clearRecentTransactions,
        }),
        [recentTransactions, addRecentTransaction, clearRecentTransactions],
    );

    return <RecentTransactionsContext.Provider value={value}>{children}</RecentTransactionsContext.Provider>;
}

export function useRecentTransactions() {
    const context = useContext(RecentTransactionsContext);
    if (!context) {
        throw new Error('useRecentTransactions must be used inside RecentTransactionsProvider');
    }
    return context;
}
