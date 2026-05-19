import { QuickDefaults } from '@/components/QuickDefaults';
import { RecentTransactions } from '@/components/RecentTransactions';
import { Deposit } from '@/components/instructions/Deposit';
import { Withdraw } from '@/components/instructions/Withdraw';

import { InstructionPanel } from './instruction-panel';

export function OperateEscrowRoute() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Deposit / Withdraw</h1>
            </div>
            <QuickDefaults />
            <RecentTransactions />
            <div className="grid gap-4 lg:grid-cols-2">
                <InstructionPanel title="Deposit">
                    <Deposit />
                </InstructionPanel>
                <InstructionPanel title="Withdraw">
                    <Withdraw />
                </InstructionPanel>
            </div>
        </div>
    );
}
