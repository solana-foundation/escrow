import { QuickDefaults } from '@/components/QuickDefaults';
import { RecentTransactions } from '@/components/RecentTransactions';
import { BlockMint } from '@/components/instructions/BlockMint';
import { RemoveExtension } from '@/components/instructions/RemoveExtension';
import { SetImmutable } from '@/components/instructions/SetImmutable';
import { UnblockTokenExtension } from '@/components/instructions/UnblockTokenExtension';
import { UpdateAdmin } from '@/components/instructions/UpdateAdmin';

import { InstructionPanel } from './instruction-panel';

export function ManageEscrowRoute() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Manage Escrow</h1>
            </div>
            <QuickDefaults />
            <RecentTransactions />
            <div className="grid gap-4 lg:grid-cols-2">
                <InstructionPanel title="Update Admin">
                    <UpdateAdmin />
                </InstructionPanel>
                <InstructionPanel title="Set Immutable">
                    <SetImmutable />
                </InstructionPanel>
                <InstructionPanel title="Block Mint">
                    <BlockMint />
                </InstructionPanel>
                <InstructionPanel title="Unblock Token Extension">
                    <UnblockTokenExtension />
                </InstructionPanel>
                <InstructionPanel title="Remove Extension">
                    <RemoveExtension />
                </InstructionPanel>
            </div>
        </div>
    );
}
