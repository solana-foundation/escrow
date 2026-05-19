import { useState } from 'react';
import { Link } from 'react-router';
import { Badge, Button } from '@solana/design-system';
import {
    Ban,
    Clock3,
    Coins,
    FileText,
    KeyRound,
    ListX,
    LockKeyhole,
    RefreshCw,
    ShieldCheck,
    SlidersHorizontal,
    Undo2,
    UserCheck,
    Webhook,
} from 'lucide-react';

import { QuickDefaults } from '@/components/QuickDefaults';
import { RecentTransactions } from '@/components/RecentTransactions';
import { WalletButton } from '@/components/solana/solana-provider';
import { AddTimelock } from '@/components/instructions/AddTimelock';
import { AllowMint } from '@/components/instructions/AllowMint';
import { BlockMint } from '@/components/instructions/BlockMint';
import { BlockTokenExtension } from '@/components/instructions/BlockTokenExtension';
import { RemoveExtension } from '@/components/instructions/RemoveExtension';
import { SetArbiter } from '@/components/instructions/SetArbiter';
import { SetHook } from '@/components/instructions/SetHook';
import { SetImmutable } from '@/components/instructions/SetImmutable';
import { UnblockTokenExtension } from '@/components/instructions/UnblockTokenExtension';
import { UpdateAdmin } from '@/components/instructions/UpdateAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useWallet } from '@/contexts/WalletContext';
import { useSavedValues } from '@/contexts/SavedValuesContext';
import { useEscrowDashboardData } from '@/hooks/use-escrow-accounts';
import {
    formatAddress,
    formatTokenAmount,
    type AllowedMintRecord,
    type EscrowExtensionsRecord,
    type EscrowRecord,
    type ReceiptRecord,
} from '@/lib/escrow-model';

type ManageAction =
    | 'add-timelock'
    | 'allow-mint'
    | 'block-mint'
    | 'block-token-extension'
    | 'remove-extension'
    | 'set-arbiter'
    | 'set-hook'
    | 'set-immutable'
    | 'unblock-token-extension'
    | 'update-admin';

type DialogStep = 'confirm' | 'form';

const ACTION_LABELS: Record<ManageAction, string> = {
    'add-timelock': 'Add Timelock',
    'allow-mint': 'Allow Mint',
    'block-mint': 'Block Mint',
    'block-token-extension': 'Block Token Extension',
    'remove-extension': 'Remove Extension',
    'set-arbiter': 'Set Arbiter',
    'set-hook': 'Set Hook',
    'set-immutable': 'Set Immutable',
    'unblock-token-extension': 'Unblock Token Extension',
    'update-admin': 'Update Admin',
};

function actionDescription(action: ManageAction) {
    if (action === 'allow-mint') return 'Permit a mint for deposits into this escrow.';
    if (action === 'block-mint') return 'Remove an allowed mint account and return its rent.';
    if (action === 'add-timelock') return 'Set the lock duration applied to new receipt withdrawals.';
    if (action === 'set-hook') return 'Configure a hook program invoked during escrow operations.';
    if (action === 'set-arbiter') return 'Require your connected wallet to co-sign withdrawals.';
    if (action === 'block-token-extension') return 'Block a Token-2022 extension from future deposits.';
    if (action === 'unblock-token-extension') return 'Remove an extension from the blocked list.';
    if (action === 'remove-extension') return 'Remove a configured escrow extension.';
    if (action === 'set-immutable') return 'Permanently lock escrow configuration.';
    return 'Update the admin authority using your connected wallet.';
}

function formatDuration(seconds: bigint) {
    if (seconds === 0n) return 'Disabled';
    const days = seconds / 86_400n;
    if (days > 0n && seconds % 86_400n === 0n) return `${days.toString()}d`;
    const hours = seconds / 3_600n;
    if (hours > 0n && seconds % 3_600n === 0n) return `${hours.toString()}h`;
    return `${seconds.toString()}s`;
}

function escrowStatus(escrow: EscrowRecord, extensions: EscrowExtensionsRecord | null) {
    if (escrow.isImmutable) return <Badge variant="warning">Immutable</Badge>;
    if (extensions && extensions.extensionCount > 0) return <Badge variant="info">Configured</Badge>;
    return <Badge variant="success">Mutable</Badge>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="truncate font-mono text-xs text-foreground">{value}</p>
        </div>
    );
}

function ActionSummary({
    allowedMints,
    escrow,
    extensions,
    receipts,
}: {
    allowedMints: readonly AllowedMintRecord[];
    escrow: EscrowRecord;
    extensions: EscrowExtensionsRecord | null;
    receipts: readonly ReceiptRecord[];
}) {
    return (
        <div className="grid gap-3 rounded-lg border border-sand-300 bg-sand-100 p-3 text-sm">
            <DetailRow label="Escrow" value={escrow.address} />
            <DetailRow label="Admin" value={escrow.admin} />
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <p className="text-xs text-muted-foreground">Receipts</p>
                    <p className="font-semibold tabular-nums">{receipts.length}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Allowed Mints</p>
                    <p className="font-semibold tabular-nums">{allowedMints.length}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Extensions</p>
                    <p className="font-semibold tabular-nums">{extensions?.extensionCount ?? 0}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">Lock Duration</p>
                    <p className="font-semibold tabular-nums">
                        {extensions?.lockDuration ? formatDuration(extensions.lockDuration) : 'None'}
                    </p>
                </div>
            </div>
        </div>
    );
}

function ImmutableConfirmation({
    escrow,
    onCancel,
    onContinue,
}: {
    escrow: EscrowRecord;
    onCancel: () => void;
    onContinue: () => void;
}) {
    return (
        <div className="space-y-4">
            <DialogHeader>
                <DialogTitle className="text-destructive">Set Immutable</DialogTitle>
                <DialogDescription>
                    This permanently prevents future escrow configuration changes for {formatAddress(escrow.address)}.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button type="button" variant="secondary" onClick={onCancel}>
                    Cancel
                </Button>
                <Button
                    type="button"
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={onContinue}
                >
                    Continue
                </Button>
            </DialogFooter>
        </div>
    );
}

function ManageDialog({
    action,
    allowedMints,
    escrow,
    extensions,
    onOpenChange,
    onSuccess,
    receipts,
}: {
    action: ManageAction | null;
    allowedMints: readonly AllowedMintRecord[];
    escrow: EscrowRecord;
    extensions: EscrowExtensionsRecord | null;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    receipts: readonly ReceiptRecord[];
}) {
    const open = action !== null;
    const [step, setStep] = useState<DialogStep>('confirm');
    const title = action ? ACTION_LABELS[action] : '';
    const firstBlockedExtension = extensions?.blockedTokenExtensions[0]?.toString() ?? '5';
    const firstExtensionType = extensions?.extensions[0]?.rawType.toString() ?? '0';

    function closeDialog(nextOpen: boolean) {
        if (!nextOpen) setStep('confirm');
        onOpenChange(nextOpen);
    }

    function handleSuccess() {
        onSuccess();
        closeDialog(false);
    }

    function form() {
        if (!action) return null;
        const props = {
            initialEscrow: escrow.address,
            onSuccess: handleSuccess,
            submitLabel: title,
        };

        if (action === 'update-admin')
            return <UpdateAdmin key={`${escrow.address}-update-admin`} hideKnownFields {...props} />;
        if (action === 'set-immutable')
            return <SetImmutable key={`${escrow.address}-immutable`} hideKnownFields {...props} />;
        if (action === 'allow-mint') return <AllowMint key={`${escrow.address}-allow-mint`} {...props} />;
        if (action === 'block-mint') return <BlockMint key={`${escrow.address}-block-mint`} {...props} />;
        if (action === 'add-timelock')
            return <AddTimelock key={`${escrow.address}-timelock`} hideKnownFields {...props} />;
        if (action === 'set-hook') return <SetHook key={`${escrow.address}-hook`} hideKnownFields {...props} />;
        if (action === 'set-arbiter')
            return <SetArbiter key={`${escrow.address}-arbiter`} hideKnownFields {...props} />;
        if (action === 'block-token-extension') {
            return <BlockTokenExtension key={`${escrow.address}-block-extension`} hideKnownFields {...props} />;
        }
        if (action === 'unblock-token-extension') {
            return (
                <UnblockTokenExtension
                    key={`${escrow.address}-unblock-extension`}
                    hideKnownFields
                    initialExtensionType={firstBlockedExtension}
                    {...props}
                />
            );
        }
        return (
            <RemoveExtension
                key={`${escrow.address}-remove-extension`}
                hideKnownFields
                initialExtensionType={firstExtensionType}
                {...props}
            />
        );
    }

    return (
        <Dialog open={open} onOpenChange={closeDialog}>
            {action && (
                <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
                    {action === 'set-immutable' && step === 'confirm' ? (
                        <ImmutableConfirmation
                            escrow={escrow}
                            onCancel={() => closeDialog(false)}
                            onContinue={() => setStep('form')}
                        />
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle>{title}</DialogTitle>
                                <DialogDescription>{actionDescription(action)}</DialogDescription>
                            </DialogHeader>
                            <ActionSummary
                                allowedMints={allowedMints}
                                escrow={escrow}
                                extensions={extensions}
                                receipts={receipts}
                            />
                            {form()}
                        </>
                    )}
                </DialogContent>
            )}
        </Dialog>
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

function EscrowCard({
    allowedMints,
    escrow,
    extensions,
    onRefresh,
    receipts,
}: {
    allowedMints: readonly AllowedMintRecord[];
    escrow: EscrowRecord;
    extensions: EscrowExtensionsRecord | null;
    onRefresh: () => void;
    receipts: readonly ReceiptRecord[];
}) {
    const [action, setAction] = useState<ManageAction | null>(null);
    const depositedAmount = receipts.reduce((sum, receipt) => sum + receipt.amount, 0n);
    const blockedCount = extensions?.blockedTokenExtensions.length ?? 0;
    const canEdit = !escrow.isImmutable;

    return (
        <>
            <Card className="border-0 border-all-dashed-medium bg-card transition-colors hover:bg-sand-100">
                <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <ShieldCheck className="h-4 w-4 shrink-0 text-sand-1100" />
                            <div className="min-w-0">
                                <p className="font-semibold text-foreground">Escrow</p>
                                <p className="truncate font-mono text-xs text-muted-foreground">
                                    {formatAddress(escrow.address)}
                                </p>
                            </div>
                        </div>
                        {escrowStatus(escrow, extensions)}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <Metric icon={Coins} label="Allowed Mints" value={allowedMints.length.toString()} />
                        <Metric icon={FileText} label="Receipts" value={receipts.length.toString()} />
                        <Metric
                            icon={Clock3}
                            label="Timelock"
                            value={extensions?.lockDuration ? formatDuration(extensions.lockDuration) : 'None'}
                        />
                        <Metric icon={Ban} label="Blocked Exts" value={blockedCount.toString()} />
                    </div>

                    <div className="space-y-2 text-sm">
                        <DetailRow label="Admin" value={escrow.admin} />
                        <DetailRow label="Deposited by wallet" value={formatTokenAmount(depositedAmount)} />
                        {extensions?.hookProgram && <DetailRow label="Hook Program" value={extensions.hookProgram} />}
                        {extensions?.arbiter && <DetailRow label="Arbiter" value={extensions.arbiter} />}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            iconLeft={<UserCheck />}
                            onClick={() => setAction('update-admin')}
                        >
                            Update Admin
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            iconLeft={<LockKeyhole />}
                            onClick={() => setAction('set-immutable')}
                            disabled={!canEdit}
                        >
                            Set Immutable
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            iconLeft={<Coins />}
                            onClick={() => setAction('allow-mint')}
                            disabled={!canEdit}
                        >
                            Allow Mint
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            iconLeft={<Ban />}
                            onClick={() => setAction('block-mint')}
                            disabled={!canEdit}
                        >
                            Block Mint
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            iconLeft={<Clock3 />}
                            onClick={() => setAction('add-timelock')}
                            disabled={!canEdit}
                        >
                            Add Timelock
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            iconLeft={<Webhook />}
                            onClick={() => setAction('set-hook')}
                            disabled={!canEdit}
                        >
                            Set Hook
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            iconLeft={<KeyRound />}
                            onClick={() => setAction('set-arbiter')}
                            disabled={!canEdit}
                        >
                            Set Arbiter
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            iconLeft={<ListX />}
                            onClick={() => setAction('block-token-extension')}
                            disabled={!canEdit}
                        >
                            Block Extension
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            iconLeft={<Undo2 />}
                            onClick={() => setAction('unblock-token-extension')}
                            disabled={!canEdit || blockedCount === 0}
                        >
                            Unblock Extension
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            iconLeft={<SlidersHorizontal />}
                            onClick={() => setAction('remove-extension')}
                            disabled={!canEdit || !extensions?.extensionCount}
                        >
                            Remove Extension
                        </Button>
                    </div>
                </CardContent>
            </Card>
            <ManageDialog
                action={action}
                allowedMints={allowedMints}
                escrow={escrow}
                extensions={extensions}
                onOpenChange={open => !open && setAction(null)}
                onSuccess={onRefresh}
                receipts={receipts}
            />
        </>
    );
}

function EmptyManagedEscrows() {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <ShieldCheck className="h-8 w-8 text-sand-1000" />
            <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">No managed escrows</h2>
                <p className="text-sm text-muted-foreground">Create an escrow first, then manage configuration here.</p>
            </div>
            <Link
                to="/create"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
                Create Escrow
            </Link>
        </div>
    );
}

export function ManageEscrowRoute() {
    const { connected } = useWallet();
    const { mints } = useSavedValues();
    const dashboard = useEscrowDashboardData(mints);
    const data = dashboard.data;
    const escrows = data?.adminEscrows ?? [];
    const allowedMints = data?.allowedMints ?? [];
    const receipts = data?.escrowReceipts ?? [];
    const dataError = dashboard.error instanceof Error ? dashboard.error.message : null;

    if (!connected) {
        return (
            <div className="mx-auto max-w-3xl space-y-6">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Manage Escrow</h1>
                <Card className="border-0 border-all-dashed-medium bg-card">
                    <CardContent className="flex flex-col items-center justify-center gap-4 py-14 text-center">
                        <p className="text-sm text-muted-foreground">Connect wallet to load managed escrows.</p>
                        <WalletButton />
                    </CardContent>
                </Card>
                <QuickDefaults />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Manage Escrow</h1>
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

            <Card className="relative overflow-hidden border-0 border-all-dashed-medium bg-card">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-foreground" />
                            <CardTitle>Managed Escrows</CardTitle>
                        </div>
                        {escrows.length > 0 && <Badge variant="success">{escrows.length}</Badge>}
                    </div>
                </CardHeader>
                <CardContent>
                    {dataError ? (
                        <div className="py-6 text-sm text-destructive">{dataError}</div>
                    ) : dashboard.isLoading ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                            Loading escrows...
                        </div>
                    ) : escrows.length > 0 ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {escrows.map(escrow => (
                                <EscrowCard
                                    key={escrow.address}
                                    allowedMints={allowedMints.filter(record => record.escrow === escrow.address)}
                                    escrow={escrow}
                                    extensions={data?.extensions.get(escrow.address) ?? null}
                                    onRefresh={() => void dashboard.refetch()}
                                    receipts={receipts.filter(receipt => receipt.escrow === escrow.address)}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyManagedEscrows />
                    )}
                </CardContent>
            </Card>

            <QuickDefaults />
            <RecentTransactions />
        </div>
    );
}
