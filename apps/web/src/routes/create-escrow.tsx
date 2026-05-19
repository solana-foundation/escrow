import { RecentTransactions } from '@/components/RecentTransactions';
import { AddTimelock } from '@/components/instructions/AddTimelock';
import { AllowMint } from '@/components/instructions/AllowMint';
import { BlockTokenExtension } from '@/components/instructions/BlockTokenExtension';
import { CreateEscrow } from '@/components/instructions/CreateEscrow';
import { SetArbiter } from '@/components/instructions/SetArbiter';
import { SetHook } from '@/components/instructions/SetHook';

import { InstructionPanel } from './instruction-panel';

export function CreateEscrowRoute() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create Escrow</h1>
            </div>
            <RecentTransactions />
            <div className="grid gap-4 lg:grid-cols-2">
                <InstructionPanel title="Create Escrow">
                    <CreateEscrow />
                </InstructionPanel>
                <InstructionPanel title="Allow Mint">
                    <AllowMint />
                </InstructionPanel>
                <InstructionPanel title="Add Timelock">
                    <AddTimelock />
                </InstructionPanel>
                <InstructionPanel title="Set Hook">
                    <SetHook />
                </InstructionPanel>
                <InstructionPanel title="Set Arbiter">
                    <SetArbiter />
                </InstructionPanel>
                <InstructionPanel title="Block Token Extension">
                    <BlockTokenExtension />
                </InstructionPanel>
            </div>
        </div>
    );
}
