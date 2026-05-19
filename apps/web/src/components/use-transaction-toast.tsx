import { toast } from 'sonner';

import { useClusterConfig } from '@/hooks/use-cluster-config';
import { getClusterFromClusterId, getSolanaExplorerUrl } from '@/lib/explorer';
import { formatTransactionError } from '@/lib/transactionErrors';

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : formatTransactionError(error);
}

export function useTransactionToast() {
    const { id } = useClusterConfig();
    const cluster = getClusterFromClusterId(id);

    return {
        onError: (error: unknown) => {
            toast.error('Transaction failed', {
                description: errorMessage(error),
            });
        },
        onSuccess: (signature: string) => {
            toast.success('Transaction confirmed', {
                description: (
                    <a
                        className="font-medium underline underline-offset-4"
                        href={getSolanaExplorerUrl(signature, cluster)}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        View Transaction
                    </a>
                ),
            });
        },
    };
}
