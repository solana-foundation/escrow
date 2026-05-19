import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { useMemo } from 'react';

import { useClusterConfig } from '@/hooks/use-cluster-config';

function wsUrlFromHttp(httpUrl: string): string {
    if (httpUrl.startsWith('/')) {
        const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        return `${protocol}${window.location.host}${httpUrl}`;
    }
    return httpUrl.replace(/^https?:\/\//, match => (match === 'https://' ? 'wss://' : 'ws://'));
}

export function useRpc() {
    const { url } = useClusterConfig();
    return useMemo(() => createSolanaRpc(url), [url]);
}

export function useRpcSubscriptions() {
    const { url } = useClusterConfig();
    return useMemo(() => createSolanaRpcSubscriptions(wsUrlFromHttp(url)), [url]);
}
