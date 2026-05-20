import { Badge, Button } from '@solana/design-system';

import { useClusterConfig } from '@/hooks/use-cluster-config';
import { getClusterFromClusterId, getSolanaExplorerUrl } from '@/lib/explorer';
import { formatTransactionErrorWithLogs } from '@/lib/transactionErrors';

interface TxResultProps {
    error: unknown;
    signature: string | null | undefined;
}

export function TxResult({ signature, error }: TxResultProps) {
    const { id } = useClusterConfig();
    const errorMessage = error ? formatTransactionErrorWithLogs(error) : null;

    if (!signature && !errorMessage) return null;

    const cluster = getClusterFromClusterId(id);

    if (errorMessage) {
        return (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/20 bg-card px-3 py-2 text-sm text-destructive">
                <Badge variant="danger">Failed</Badge>
                <span className="whitespace-pre-wrap break-words">{errorMessage}</span>
            </div>
        );
    }

    if (signature) {
        const explorerUrl = getSolanaExplorerUrl(signature, cluster);
        return (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                <Badge variant="success">Success</Badge>
                <span className="font-mono text-sand-1100">tx: {signature.slice(0, 8)}...</span>
                <Button asChild size="sm" variant="secondary">
                    <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                        View on Explorer
                    </a>
                </Button>
            </div>
        );
    }

    return null;
}
