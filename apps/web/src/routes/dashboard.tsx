import { Link } from 'react-router';
import type { ComponentType } from 'react';
import { Badge } from '@solana/design-system/badge';
import { ArrowRight, Coins, FileText, LockKeyhole, ShieldCheck, WalletCards } from 'lucide-react';

import { ProgramBadge } from '@/components/ProgramBadge';
import { QuickDefaults } from '@/components/QuickDefaults';
import { RecentTransactions } from '@/components/RecentTransactions';
import { NAV_ITEMS } from '@/components/nav-items';
import { WalletButton } from '@/components/solana/solana-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWallet } from '@/contexts/WalletContext';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useEscrowDashboardData } from '@/hooks/use-escrow-accounts';
import { formatTokenAmount, isReceiptWithdrawable } from '@/lib/escrow-model';

interface SummaryLinkCardProps {
    icon: ComponentType<{ className?: string }>;
    rows: Array<{ label: string; value: string }>;
    title: string;
    to: string;
}

function SummaryLinkCard({ icon: Icon, rows, title, to }: SummaryLinkCardProps) {
    return (
        <Link
            to={to}
            className="group relative flex flex-col overflow-hidden rounded-lg border-0 border-all-dashed-medium bg-card transition-colors hover:bg-sand-100"
        >
            <div className="flex-grow p-5">
                <div className="mb-6 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-sand-1100" />
                        <h2 className="text-[17px] font-semibold text-foreground">{title}</h2>
                    </div>
                    <ArrowRight className="h-4 w-4 text-sand-1000 transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="space-y-4">
                    {rows.map((row, index) => (
                        <div key={row.label} className="space-y-4">
                            {index > 0 && <div className="h-px w-full bg-sand-100" />}
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-sand-1100">{row.label}</span>
                                <span className="truncate text-base font-bold tabular-nums text-foreground">
                                    {row.value}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </Link>
    );
}

export function Dashboard() {
    const { connected } = useWallet();
    const { mints } = useSavedValues();
    const dashboard = useEscrowDashboardData(mints);

    const data = dashboard.data;
    const adminEscrows = data?.adminEscrows ?? [];
    const depositorReceipts = data?.depositorReceipts ?? [];
    const escrowReceipts = data?.escrowReceipts ?? [];
    const allowedMints = data?.allowedMints ?? [];
    const extensionRecords = data ? [...data.extensions.values()] : [];
    const configuredEscrows = extensionRecords.filter(record => record.extensionCount > 0).length;
    const withdrawableReceipts = depositorReceipts.filter(receipt =>
        isReceiptWithdrawable(receipt, data?.extensions.get(receipt.escrow) ?? null),
    ).length;
    const totalDeposited = depositorReceipts.reduce((sum, receipt) => sum + receipt.amount, 0n);
    const extensionCount = extensionRecords.reduce((sum, record) => sum + record.extensionCount, 0);
    const loadingValue = dashboard.isLoading || dashboard.isFetching ? 'Loading' : '0';
    const dataError = dashboard.error instanceof Error ? dashboard.error.message : null;
    const nextAction =
        withdrawableReceipts > 0
            ? {
                  description: `${withdrawableReceipts} receipt${withdrawableReceipts === 1 ? '' : 's'} can be withdrawn.`,
                  label: 'Withdraw Tokens',
                  secondaryHref: '/manage',
                  secondaryLabel: 'Manage Escrows',
                  to: '/operate',
              }
            : adminEscrows.length > 0
              ? {
                    description: `${adminEscrows.length} escrow${adminEscrows.length === 1 ? '' : 's'} managed by this wallet.`,
                    label: 'Manage Escrows',
                    secondaryHref: '/operate',
                    secondaryLabel: 'Deposit Tokens',
                    to: '/manage',
                }
              : {
                    description: 'Create an escrow to start configuring deposits and token rules.',
                    label: 'Create Escrow',
                    secondaryHref: '/operate',
                    secondaryLabel: 'Deposit Tokens',
                    to: '/create',
                };

    return (
        <div className="space-y-8">
            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <ProgramBadge />
                        {connected && (
                            <Badge variant={dashboard.isFetching ? 'info' : 'success'}>
                                {dashboard.isFetching ? 'Syncing' : 'Live'}
                            </Badge>
                        )}
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">Escrow Program</h1>
                </div>
                <div className="rounded-lg border bg-card p-4">
                    <div className="text-sm font-medium text-foreground">Program tools</div>
                    <div className="mt-3 grid gap-2">
                        {NAV_ITEMS.filter(item => item.path !== '/').map(item => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className="flex items-center gap-2 rounded-md border border-border-low px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-sand-100"
                            >
                                <item.icon className="h-4 w-4 text-muted-foreground" />
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
            {!connected ? (
                <Card className="border-0 border-all-dashed-medium bg-card">
                    <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
                        <WalletCards className="h-8 w-8 text-sand-1000" />
                        <div className="space-y-1">
                            <h2 className="text-lg font-semibold text-foreground">Connect wallet</h2>
                            <p className="text-sm text-muted-foreground">Escrow data loads from your wallet.</p>
                        </div>
                        <WalletButton />
                    </CardContent>
                </Card>
            ) : (
                <>
                    {dataError && (
                        <Card className="border-0 border-all-dashed-medium bg-card">
                            <CardContent className="py-5">
                                <p className="text-sm text-destructive">{dataError}</p>
                            </CardContent>
                        </Card>
                    )}
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <SummaryLinkCard
                            icon={ShieldCheck}
                            title="Managed Escrows"
                            to="/manage"
                            rows={[
                                { label: 'Total', value: data ? adminEscrows.length.toString() : loadingValue },
                                {
                                    label: 'Configured',
                                    value: data ? configuredEscrows.toString() : loadingValue,
                                },
                            ]}
                        />
                        <SummaryLinkCard
                            icon={FileText}
                            title="Deposit Receipts"
                            to="/operate"
                            rows={[
                                { label: 'Receipts', value: data ? depositorReceipts.length.toString() : loadingValue },
                                {
                                    label: 'Withdrawable',
                                    value: data ? withdrawableReceipts.toString() : loadingValue,
                                },
                            ]}
                        />
                        <SummaryLinkCard
                            icon={Coins}
                            title="Known Mints"
                            to="/create"
                            rows={[
                                { label: 'Allowed', value: data ? allowedMints.length.toString() : loadingValue },
                                { label: 'Saved', value: mints.length.toString() },
                            ]}
                        />
                        <SummaryLinkCard
                            icon={LockKeyhole}
                            title="Escrow Activity"
                            to="/manage"
                            rows={[
                                { label: 'Deposits', value: data ? escrowReceipts.length.toString() : loadingValue },
                                { label: 'Extensions', value: data ? extensionCount.toString() : loadingValue },
                            ]}
                        />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                        <Card className="border-0 border-all-dashed-medium bg-card">
                            <CardHeader>
                                <CardTitle>Total Deposited By Wallet</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-semibold tabular-nums text-foreground">
                                    {data ? formatTokenAmount(totalDeposited) : 'Loading'}
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="border-0 border-all-dashed-medium bg-card">
                            <CardHeader>
                                <CardTitle>Next Action</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                <p className="text-sm text-muted-foreground">
                                    {dashboard.isLoading ? 'Escrow data is syncing.' : nextAction.description}
                                </p>
                                <Link
                                    to={nextAction.to}
                                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                                >
                                    {nextAction.label}
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <Link
                                    to={nextAction.secondaryHref}
                                    className="inline-flex items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                                >
                                    {nextAction.secondaryLabel}
                                </Link>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
            <QuickDefaults />
            <RecentTransactions />
        </div>
    );
}
