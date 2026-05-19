import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'escrow-program-id';
const viteEnv = import.meta.env as unknown as {
    readonly VITE_PROGRAM_ID?: string;
};
const DEFAULT_PROGRAM_ID = viteEnv.VITE_PROGRAM_ID ?? 'Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg';

interface ProgramContextType {
    programId: string;
    setProgramId: (id: string) => void;
}

const ProgramContext = createContext<ProgramContextType | null>(null);

export function ProgramProvider({ children }: { children: React.ReactNode }) {
    const [programId, setProgramIdState] = useState<string>(DEFAULT_PROGRAM_ID);

    useEffect(() => {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
            setProgramIdState(stored);
        }
    }, []);

    const setProgramId = useCallback((id: string) => {
        window.localStorage.setItem(STORAGE_KEY, id);
        setProgramIdState(id);
    }, []);

    const value = useMemo(() => ({ programId, setProgramId }), [programId, setProgramId]);

    return <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>;
}

export function useProgramContext() {
    const ctx = useContext(ProgramContext);
    if (!ctx) throw new Error('useProgramContext must be used inside ProgramProvider');
    return ctx;
}

export { DEFAULT_PROGRAM_ID };
