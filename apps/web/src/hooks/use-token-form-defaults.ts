import { useEffect, useRef, useState } from 'react';

import { getClusterUsdcMint, TOKEN_PROGRAM_ID } from '@/lib/token';

import { useClusterConfig } from './use-cluster-config';

export function useTokenFormDefaults(initialMint = '') {
    const { id } = useClusterConfig();
    const clusterMint = getClusterUsdcMint(id);
    const previousClusterMintRef = useRef(clusterMint);
    const [mint, setMint] = useState(initialMint || clusterMint);
    const [tokenProgram, setTokenProgram] = useState<string>(TOKEN_PROGRAM_ID);

    useEffect(() => {
        const previousClusterMint = previousClusterMintRef.current;
        previousClusterMintRef.current = clusterMint;

        if (initialMint) return;

        setMint(current => {
            if (!current) return clusterMint;
            if (current === previousClusterMint) return clusterMint;
            return current;
        });
    }, [clusterMint, initialMint]);

    return {
        clusterMint,
        mint,
        setMint,
        setTokenProgram,
        tokenProgram,
    };
}
