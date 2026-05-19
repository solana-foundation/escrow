import { Link } from 'react-router';

import { ProgramBadge } from '@/components/ProgramBadge';
import { QuickDefaults } from '@/components/QuickDefaults';
import { RecentTransactions } from '@/components/RecentTransactions';
import { NAV_ITEMS } from '@/components/nav-items';

export function Dashboard() {
    return (
        <div className="space-y-8">
            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <ProgramBadge />
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
            <QuickDefaults />
            <RecentTransactions />
        </div>
    );
}
