import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Badge, Button } from '@solana/design-system';
import { ArrowRightLeft, Clock3, Coins, FileText, Plus, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react';

import { RecentTransactions } from '@/components/RecentTransactions';
import { Deposit } from '@/components/instructions/Deposit';
import { Withdraw } from '@/components/instructions/Withdraw';
import { WalletButton } from '@/components/solana/solana-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useWallet } from '@/contexts/WalletContext';
import { useEscrowDashboardData } from '@/hooks/use-escrow-accounts';
import {
    formatAddress,
    formatTokenAmount,
    isReceiptWithdrawable,
    receiptUnlockTimestamp,
    type AllowedMintRecord,
    type EscrowExtensionsRecord,
    type EscrowRecord,
    type ReceiptRecord,
} from '@/lib/escrow-model';

type OperateAction = 'deposit' | 'withdraw';

interface DepositTarget {
    allowedMints: readonly AllowedMintRecord[];
    escrow: EscrowRecord | null;
    escrowAddress: string;
    receipts: readonly ReceiptRecord[];
}

function formatTimestamp(value: bigint) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(Number(value) * 1000));
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="truncate font-mono text-xs text-foreground">{value}</p>
        </div>
    );
}

function Metric({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-lg border border-sand-300 bg-sand-100 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </div>
            <p className="truncate font-semibold tabular-nums text-foreground">{value}</p>
        </div>
    );
}

function OperationDialog({
    action,
    initialAmount = '',
    initialEscrow = '',
    initialMint = '',
    initialReceipt = '',
    onOpenChange,
    onSuccess,
    open,
}: {
    action: OperateAction;
    initialAmount?: string;
    initialEscrow?: string;
    initialMint?: string;
    initialReceipt?: string;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    open: boolean;
}) {
    const isDeposit = action === 'deposit';
    const title = isDeposit ? 'Deposit Tokens' : 'Withdraw Tokens';

    function handleSuccess() {
        onSuccess();
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {isDeposit
                            ? 'Escrow and mint fields are prefilled when this action comes from a known escrow target.'
                            : 'Escrow, mint, and receipt are selected from the receipt card.'}
                    </DialogDescription>
                </DialogHeader>
                {isDeposit ? (
                    <Deposit
                        key={`${initialEscrow}-${initialMint}-deposit`}
                        hideKnownFields={Boolean(initialEscrow && initialMint)}
                        initialAmount={initialAmount}
                        initialEscrow={initialEscrow}
                        initialMint={initialMint}
                        onSuccess={handleSuccess}
                        submitLabel="Deposit Tokens"
                    />
                ) : (
                    <Withdraw
                        key={`${initialReceipt}-withdraw`}
                        hideKnownFields={Boolean(initialEscrow && initialMint && initialReceipt)}
                        initialEscrow={initialEscrow}
                        initialMint={initialMint}
                        initialReceipt={initialReceipt}
                        onSuccess={handleSuccess}
                        submitLabel="Withdraw Tokens"
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function DepositTargetCard({ onRefresh, target }: { onRefresh: () => void; target: DepositTarget }) {
    const [open, setOpen] = useState(false);
    const preferredMint = target.allowedMints[0]?.mint ?? '';
    const configured = target.escrow ? target.escrow.isImmutable : false;

    return (
        <>
            <Card className="border-0 border-all-dashed-medium bg-card transition-colors hover:bg-sand-100">
                <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <ShieldCheck className="h-4 w-4 shrink-0 text-sand-1100" />
                            <div className="min-w-0">
                                <p className="font-semibold text-foreground">Deposit Target</p>
                                <p className="truncate font-mono text-xs text-muted-foreground">
                                    {formatAddress(target.escrowAddress)}
                                </p>
                            </div>
                        </div>
                        <Badge variant={configured ? 'warning' : 'info'}>{configured ? 'Immutable' : 'Open'}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <Metric icon={Coins} label="Known Mints" value={target.allowedMints.length.toString()} />
                        <Metric icon={FileText} label="Receipts" value={target.receipts.length.toString()} />
                    </div>

                    <div className="space-y-2 text-sm">
                        {target.escrow?.admin && <DetailRow label="Admin" value={target.escrow.admin} />}
                        {preferredMint && <DetailRow label="Default Mint" value={preferredMint} />}
                    </div>

                    <Button type="button" size="sm" iconLeft={<Plus />} onClick={() => setOpen(true)}>
                        Deposit
                    </Button>
                </CardContent>
            </Card>
            <OperationDialog
                action="deposit"
                initialEscrow={target.escrowAddress}
                initialMint={preferredMint}
                onOpenChange={setOpen}
                onSuccess={onRefresh}
                open={open}
            />
        </>
    );
}

function ReceiptCard({
    extensions,
    onRefresh,
    receipt,
}: {
    extensions: EscrowExtensionsRecord | null;
    onRefresh: () => void;
    receipt: ReceiptRecord;
}) {
    const [open, setOpen] = useState(false);
    const unlockTimestamp = receiptUnlockTimestamp(receipt, extensions);
    const withdrawable = isReceiptWithdrawable(receipt, extensions);

    return (
        <>
            <Card className="border-0 border-all-dashed-medium bg-card transition-colors hover:bg-sand-100">
                <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <WalletCards className="h-4 w-4 shrink-0 text-sand-1100" />
                            <div className="min-w-0">
                                <p className="font-semibold text-foreground">Receipt</p>
                                <p className="truncate font-mono text-xs text-muted-foreground">
                                    {formatAddress(receipt.address)}
                                </p>
                            </div>
                        </div>
                        <Badge variant={withdrawable ? 'success' : 'warning'}>
                            {withdrawable ? 'Withdrawable' : 'Locked'}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <Metric icon={Coins} label="Amount" value={formatTokenAmount(receipt.amount)} />
                        <Metric
                            icon={Clock3}
                            label="Unlock"
                            value={unlockTimestamp ? formatTimestamp(unlockTimestamp) : 'Now'}
                        />
                    </div>

                    <div className="space-y-2 text-sm">
                        <DetailRow label="Escrow" value={receipt.escrow} />
                        <DetailRow label="Mint" value={receipt.mint} />
                        <DetailRow label="Deposited" value={formatTimestamp(receipt.depositedAt)} />
                    </div>

                    <Button type="button" size="sm" disabled={!withdrawable} onClick={() => setOpen(true)}>
                        Withdraw
                    </Button>
                </CardContent>
            </Card>
            <OperationDialog
                action="withdraw"
                initialEscrow={receipt.escrow}
                initialMint={receipt.mint}
                initialReceipt={receipt.address}
                onOpenChange={setOpen}
                onSuccess={onRefresh}
                open={open}
            />
        </>
    );
}

function EmptyState({ action, description, title }: { action: React.ReactNode; description: string; title: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <ArrowRightLeft className="h-8 w-8 text-sand-1000" />
            <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {action}
        </div>
    );
}

export function OperateEscrowRoute() {
    const { connected } = useWallet();
    const { defaultEscrow, defaultMint, mints } = useSavedValues();
    const dashboard = useEscrowDashboardData(mints);
    const data = dashboard.data;
    const [manualDepositOpen, setManualDepositOpen] = useState(false);
    const [manualWithdrawOpen, setManualWithdrawOpen] = useState(false);

    const depositTargets = useMemo<DepositTarget[]>(() => {
        const escrows = data?.adminEscrows ?? [];
        const allowedMints = data?.allowedMints ?? [];
        const receipts = data?.escrowReceipts ?? [];
        const targets: DepositTarget[] = escrows.map(escrow => ({
            allowedMints: allowedMints.filter(record => record.escrow === escrow.address),
            escrow,
            escrowAddress: escrow.address,
            receipts: receipts.filter(receipt => receipt.escrow === escrow.address),
        }));
        if (defaultEscrow && !targets.some(target => target.escrowAddress === defaultEscrow)) {
            targets.unshift({
                allowedMints: allowedMints.filter(record => record.escrow === defaultEscrow),
                escrow: null,
                escrowAddress: defaultEscrow,
                receipts: receipts.filter(receipt => receipt.escrow === defaultEscrow),
            });
        }
        return targets;
    }, [data, defaultEscrow]);

    const receipts = data?.depositorReceipts ?? [];
    const dataError = dashboard.error instanceof Error ? dashboard.error.message : null;

    if (!connected) {
        return (
            <div className="mx-auto max-w-3xl space-y-6">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Deposit / Withdraw</h1>
                <Card className="border-0 border-all-dashed-medium bg-card">
                    <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
                        <WalletCards className="h-8 w-8 text-sand-1000" />
                        <p className="text-sm text-muted-foreground">Connect wallet to load receipts and escrows.</p>
                        <WalletButton />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Deposit / Withdraw</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => setManualDepositOpen(true)}>
                        Manual Deposit
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setManualWithdrawOpen(true)}>
                        Manual Withdraw
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        iconLeft={<RefreshCw className={dashboard.isFetching ? 'animate-spin' : ''} />}
                        onClick={() => void dashboard.refetch()}
                        disabled={dashboard.isFetching}
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            <Card className="border-0 border-all-dashed-medium bg-card">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Coins className="h-5 w-5 text-foreground" />
                            <CardTitle>Deposit Targets</CardTitle>
                        </div>
                        {depositTargets.length > 0 && <Badge variant="success">{depositTargets.length}</Badge>}
                    </div>
                </CardHeader>
                <CardContent>
                    {dataError ? (
                        <div className="py-6 text-sm text-destructive">{dataError}</div>
                    ) : dashboard.isLoading ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            Loading escrows...
                        </div>
                    ) : depositTargets.length > 0 ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {depositTargets.map(target => (
                                <DepositTargetCard
                                    key={target.escrowAddress}
                                    target={target}
                                    onRefresh={() => void dashboard.refetch()}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title="No deposit targets"
                            description="Create or save an escrow address to make deposit actions contextual."
                            action={
                                <Button asChild variant="secondary">
                                    <Link to="/create">Create Escrow</Link>
                                </Button>
                            }
                        />
                    )}
                </CardContent>
            </Card>

            <Card className="border-0 border-all-dashed-medium bg-card">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-foreground" />
                            <CardTitle>My Receipts</CardTitle>
                        </div>
                        {receipts.length > 0 && <Badge variant="success">{receipts.length}</Badge>}
                    </div>
                </CardHeader>
                <CardContent>
                    {dashboard.isLoading ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            Loading receipts...
                        </div>
                    ) : receipts.length > 0 ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {receipts.map(receipt => (
                                <ReceiptCard
                                    key={receipt.address}
                                    extensions={data?.extensions.get(receipt.escrow) ?? null}
                                    receipt={receipt}
                                    onRefresh={() => void dashboard.refetch()}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title="No receipts"
                            description="Deposit tokens first, then withdraw from receipt cards when they are ready."
                            action={
                                <Button type="button" variant="secondary" onClick={() => setManualDepositOpen(true)}>
                                    Deposit Tokens
                                </Button>
                            }
                        />
                    )}
                </CardContent>
            </Card>

            <OperationDialog
                action="deposit"
                initialEscrow={defaultEscrow}
                initialMint={defaultMint}
                onOpenChange={setManualDepositOpen}
                onSuccess={() => void dashboard.refetch()}
                open={manualDepositOpen}
            />
            <OperationDialog
                action="withdraw"
                onOpenChange={setManualWithdrawOpen}
                onSuccess={() => void dashboard.refetch()}
                open={manualWithdrawOpen}
            />
            <RecentTransactions />
        </div>
    );
}
