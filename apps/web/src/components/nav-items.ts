import { ArrowLeftRight, LayoutDashboard, PlusCircle, SlidersHorizontal } from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

export interface NavItem {
    icon: LucideIcon;
    label: string;
    path: string;
}

export const NAV_ITEMS: NavItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: PlusCircle, label: 'Create Escrow', path: '/create' },
    { icon: SlidersHorizontal, label: 'Manage Escrow', path: '/manage' },
    { icon: ArrowLeftRight, label: 'Deposit / Withdraw', path: '/operate' },
];
