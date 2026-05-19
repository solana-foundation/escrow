export type Cluster = 'devnet' | 'mainnet-beta' | 'testnet' | 'localnet';

export function getClusterFromClusterId(clusterId: string): Cluster {
    if (clusterId === 'solana:mainnet') return 'mainnet-beta';
    if (clusterId === 'solana:devnet') return 'devnet';
    if (clusterId === 'solana:testnet') return 'testnet';
    return 'localnet';
}

export function getClusterFromRpcUrl(rpcUrl: string): Cluster {
    if (rpcUrl.includes('devnet')) return 'devnet';
    if (rpcUrl.includes('mainnet')) return 'mainnet-beta';
    if (rpcUrl.includes('testnet')) return 'testnet';
    return 'localnet';
}

export function getSolanaExplorerUrl(signature: string, cluster: Cluster): string {
    const base = 'https://explorer.solana.com/tx/';
    if (cluster === 'mainnet-beta') return `${base}${signature}`;
    if (cluster === 'localnet') return `${base}${signature}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899`;
    return `${base}${signature}?cluster=${cluster}`;
}

export function getChainIdentifier(cluster: Cluster): string {
    if (cluster === 'mainnet-beta') return 'solana:mainnet';
    if (cluster === 'devnet') return 'solana:devnet';
    if (cluster === 'testnet') return 'solana:testnet';
    return 'solana:localnet';
}
