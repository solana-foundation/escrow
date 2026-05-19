import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useCluster, type SolanaClusterId } from '@solana/connector/react';
import { Button } from '@solana/design-system';
import { ChevronDown, Menu, Settings2 } from 'lucide-react';

import solanaLogo from '@/assets/solana-logo.svg';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { NAV_ITEMS, type NavItem } from './nav-items';
import { ProgramBadge } from './ProgramBadge';
import { SavedValuesMenu } from './SavedValuesMenu';
import { WalletButton } from './solana/solana-provider';

function ClusterButton() {
    const { cluster, clusters, setCluster } = useCluster();

    async function selectCluster(id: SolanaClusterId) {
        localStorage.setItem('escrow-cluster', id);
        await setCluster(id);
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    iconLeft={<Settings2 />}
                    iconRight={<ChevronDown className="opacity-60" />}
                    size="sm"
                    variant="secondary"
                >
                    {cluster?.label ?? 'Network'}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Network</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {clusters.map(c => (
                    <DropdownMenuItem
                        key={c.id}
                        onClick={() => {
                            void selectCluster(c.id);
                        }}
                    >
                        {c.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function isActive(pathname: string, path: string): boolean {
    return path === '/' ? pathname === '/' : pathname.startsWith(path);
}

function NavLinks({ items, pathname }: { items: NavItem[]; pathname: string }) {
    return (
        <>
            {items.map(item => {
                const active = isActive(pathname, item.path);
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                            'rounded-full px-3 py-2 text-sm font-medium transition-colors',
                            active
                                ? 'bg-sand-200 text-foreground'
                                : 'text-sand-1100 hover:bg-sand-100 hover:text-foreground',
                        )}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </>
    );
}

export function AppHeader() {
    const { pathname } = useLocation();
    const [hasScrolled, setHasScrolled] = useState(false);

    useEffect(() => {
        function handleScroll() {
            const next = window.scrollY > 0;
            setHasScrolled(prev => (prev === next ? prev : next));
        }
        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <header
            className={cn(
                'fixed inset-x-0 top-0 z-40 border-b transition-colors duration-200',
                hasScrolled
                    ? 'border-border-low/70 bg-background/70 backdrop-blur-sm'
                    : 'border-transparent bg-transparent',
            )}
        >
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
                <Link to="/" className="group flex items-center gap-2">
                    <img src={solanaLogo} alt="Solana" className="h-6 w-6 shrink-0" />
                    <span className="text-lg font-semibold tracking-tight text-foreground">Escrow</span>
                </Link>

                <nav className="hidden items-center gap-1 md:flex">
                    <NavLinks items={NAV_ITEMS} pathname={pathname} />
                </nav>

                <div className="hidden items-center gap-2 md:flex">
                    <ProgramBadge />
                    <SavedValuesMenu />
                    <WalletButton />
                    <ClusterButton />
                </div>

                <div className="flex items-center gap-2 md:hidden">
                    <ClusterButton />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                aria-label="Open navigation menu"
                                iconLeft={<Menu />}
                                iconOnly
                                size="sm"
                                variant="secondary"
                            />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {NAV_ITEMS.map(item => (
                                <DropdownMenuItem key={item.path} asChild>
                                    <Link to={item.path} className="flex items-center gap-2">
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <div className="flex flex-col gap-2 p-2">
                                <ProgramBadge />
                                <SavedValuesMenu />
                                <WalletButton />
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
