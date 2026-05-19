import { useState } from 'react';
import { Badge, Button } from '@solana/design-system';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRecentTransactions } from '@/contexts/RecentTransactionsContext';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useClusterConfig } from '@/hooks/use-cluster-config';
import { getClusterFromClusterId, getSolanaExplorerUrl } from '@/lib/explorer';
import { ellipsify } from '@/lib/utils';

export function RecentTransactions() {
    const { clearRecentTransactions, recentTransactions } = useRecentTransactions();
    const { rememberEscrow, rememberMint, rememberReceipt } = useSavedValues();
    const { id } = useClusterConfig();
    const [collapsed, setCollapsed] = useState(false);

    const cluster = getClusterFromClusterId(id);

    if (recentTransactions.length === 0) {
        return null;
    }

    return (
        <Card className="border-0 border-all-dashed-medium bg-card">
            <CardHeader className="flex-row items-center justify-between gap-4">
                <CardTitle className="text-base">Recent Transactions ({recentTransactions.length})</CardTitle>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setCollapsed(value => !value)}>
                        {collapsed ? 'Expand' : 'Collapse'}
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={clearRecentTransactions}>
                        Clear
                    </Button>
                </div>
            </CardHeader>
            {!collapsed && (
                <CardContent className="space-y-3">
                    {recentTransactions.map(tx => {
                        const explorerUrl = tx.signature ? getSolanaExplorerUrl(tx.signature, cluster) : null;
                        return (
                            <div key={tx.id} className="space-y-2 rounded-lg border bg-background/60 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <span className="text-sm font-semibold">{tx.action}</span>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={tx.status === 'failed' ? 'danger' : 'success'}>
                                            {tx.status}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(tx.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Signature:{' '}
                                    <span className="font-mono text-foreground">
                                        {tx.signature ? ellipsify(tx.signature, 10) : 'Unavailable'}
                                    </span>
                                </div>
                                {tx.error && (
                                    <div className="break-words text-xs text-destructive">Error: {tx.error}</div>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                    {explorerUrl && (
                                        <Button asChild size="sm" variant="secondary">
                                            <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                                                View Explorer
                                            </a>
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                            if (!tx.values) return;
                                            if (tx.values.escrow) rememberEscrow(tx.values.escrow);
                                            if (tx.values.mint) rememberMint(tx.values.mint);
                                            if (tx.values.receipt) rememberReceipt(tx.values.receipt);
                                        }}
                                        disabled={!tx.values}
                                    >
                                        Replay to Defaults
                                    </Button>
                                </div>
                                {tx.values && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(tx.values as Record<string, string>).map(([key, value]) => (
                                            <span
                                                key={`${tx.id}-${key}`}
                                                className="rounded-full border px-2 py-0.5 font-mono text-[11px] text-sand-1100"
                                            >
                                                {key}: {ellipsify(value, 8)}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </CardContent>
            )}
        </Card>
    );
}
