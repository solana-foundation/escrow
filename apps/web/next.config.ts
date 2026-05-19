import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    env: {
        NEXT_PUBLIC_PROGRAM_ID: process.env.NEXT_PUBLIC_PROGRAM_ID ?? 'Escrowae7RaUfNn4oEZHywMXE5zWzYCXenwrCDaEoifg',
        NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL ?? 'https://api.devnet.solana.com',
    },
    transpilePackages: ['@solana/escrow'],
};

export default nextConfig;
