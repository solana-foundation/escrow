import { useCluster } from '@solana/connector/react';
import { createContext, useCallback, useContext, useMemo } from 'react';

const FALLBACK_RPC = 'https://api.devnet.solana.com';

export const RPC_PRESETS = [
    { label: 'Devnet', url: 'https://api.devnet.solana.com' },
    { label: 'Mainnet', url: 'https://api.mainnet-beta.solana.com' },
    { label: 'Testnet', url: 'https://api.testnet.solana.com' },
    { label: 'Localhost', url: 'http://localhost:8899' },
] as const;

interface RpcContextType {
    rpcUrl: string;
    setRpcUrl: (url: string) => void;
}

const RpcContext = createContext<RpcContextType | null>(null);

export function RpcProvider({ children }: { children: React.ReactNode }) {
    const { cluster, clusters, setCluster } = useCluster();
    const rpcUrl = cluster?.url ?? FALLBACK_RPC;

    const setRpcUrl = useCallback(
        (url: string) => {
            const matchingCluster = clusters.find(c => c.url === url);
            if (matchingCluster) {
                localStorage.setItem('escrow-cluster', matchingCluster.id);
                void setCluster(matchingCluster.id);
            }
        },
        [clusters, setCluster],
    );

    const value = useMemo(() => ({ rpcUrl, setRpcUrl }), [rpcUrl, setRpcUrl]);

    return <RpcContext.Provider value={value}>{children}</RpcContext.Provider>;
}

export function useRpcContext() {
    const ctx = useContext(RpcContext);
    if (!ctx) throw new Error('useRpcContext must be used inside RpcProvider');
    return ctx;
}
