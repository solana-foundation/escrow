import { useWallet } from '@solana/connector/react';
import { type Address, address } from '@solana/kit';
import { useQuery } from '@tanstack/react-query';

import { useProgramContext } from '@/contexts/ProgramContext';
import { useClusterConfig } from '@/hooks/use-cluster-config';
import { useRpc } from '@/hooks/useRpc';
import {
    fetchAdminEscrows,
    fetchDepositorReceipts,
    fetchEscrowDashboardData,
    fetchEscrowExtensions,
    fetchEscrowReceipts,
    fetchKnownAllowedMints,
} from '@/lib/escrow-accounts';

function knownAddressesKey(addresses: readonly string[]): string {
    return [...new Set(addresses.map(value => value.trim()).filter(Boolean))].sort().join('|');
}

function knownAddresses(values: readonly string[]): Address[] {
    return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort().map(value => address(value));
}

export function useAdminEscrows() {
    const { account } = useWallet();
    const cluster = useClusterConfig();
    const { programId } = useProgramContext();
    const rpc = useRpc();

    return useQuery({
        enabled: Boolean(account),
        queryFn: () => fetchAdminEscrows(rpc, address(account!), address(programId)),
        queryKey: ['escrow', 'admin-escrows', account, cluster.id, programId],
    });
}

export function useDepositorReceipts() {
    const { account } = useWallet();
    const cluster = useClusterConfig();
    const { programId } = useProgramContext();
    const rpc = useRpc();

    return useQuery({
        enabled: Boolean(account),
        queryFn: () => fetchDepositorReceipts(rpc, address(account!), address(programId)),
        queryKey: ['escrow', 'depositor-receipts', account, cluster.id, programId],
    });
}

export function useEscrowReceipts(escrow: string | null | undefined) {
    const cluster = useClusterConfig();
    const { programId } = useProgramContext();
    const rpc = useRpc();
    const normalizedEscrow = escrow?.trim() ?? '';

    return useQuery({
        enabled: normalizedEscrow.length > 0,
        queryFn: () => fetchEscrowReceipts(rpc, address(normalizedEscrow), address(programId)),
        queryKey: ['escrow', 'escrow-receipts', normalizedEscrow, cluster.id, programId],
    });
}

export function useEscrowExtensions(escrow: string | null | undefined) {
    const cluster = useClusterConfig();
    const { programId } = useProgramContext();
    const rpc = useRpc();
    const normalizedEscrow = escrow?.trim() ?? '';

    return useQuery({
        enabled: normalizedEscrow.length > 0,
        queryFn: () => fetchEscrowExtensions(rpc, address(normalizedEscrow), address(programId)),
        queryKey: ['escrow', 'extensions', normalizedEscrow, cluster.id, programId],
    });
}

export function useKnownAllowedMints(escrows: readonly string[], mints: readonly string[]) {
    const cluster = useClusterConfig();
    const { programId } = useProgramContext();
    const rpc = useRpc();
    const normalizedEscrows = knownAddresses(escrows);
    const normalizedMints = knownAddresses(mints);

    return useQuery({
        enabled: normalizedEscrows.length > 0 && normalizedMints.length > 0,
        queryFn: () => fetchKnownAllowedMints(rpc, normalizedEscrows, normalizedMints, address(programId)),
        queryKey: [
            'escrow',
            'known-allowed-mints',
            knownAddressesKey(escrows),
            knownAddressesKey(mints),
            cluster.id,
            programId,
        ],
    });
}

export function useEscrowDashboardData(knownMints: readonly string[] = []) {
    const { account } = useWallet();
    const cluster = useClusterConfig();
    const { programId } = useProgramContext();
    const rpc = useRpc();
    const normalizedKnownMints = knownAddresses(knownMints);

    return useQuery({
        enabled: Boolean(account),
        queryFn: () => fetchEscrowDashboardData(rpc, address(account!), address(programId), normalizedKnownMints),
        queryKey: ['escrow', 'dashboard', account, knownAddressesKey(knownMints), cluster.id, programId],
    });
}
