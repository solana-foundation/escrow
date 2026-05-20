import { address, type Address } from '@solana/kit';

export const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
export const MAINNET_USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

export function getClusterUsdcMint(clusterId: string) {
    if (clusterId === 'solana:devnet') return DEVNET_USDC_MINT;
    if (clusterId === 'solana:mainnet') return MAINNET_USDC_MINT;
    return '';
}

export function normalizeTokenProgram(value: string): Address {
    return address(value.trim() || TOKEN_PROGRAM_ID);
}
