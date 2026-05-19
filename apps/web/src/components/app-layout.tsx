import { Toaster } from './ui/sonner';
import { AppHeader } from './app-header';

export function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-dvh">
            <AppHeader />
            <main className="mx-auto w-full max-w-7xl px-6 pt-24 pb-12">{children}</main>
            <Toaster />
        </div>
    );
}
