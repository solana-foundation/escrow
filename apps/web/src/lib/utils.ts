import { cva } from 'class-variance-authority';
import { type ClassValue, clsx } from 'clsx';
import type { QueryClient } from '@tanstack/react-query';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function ellipsify(str = '', len = 4, delimiter = '..') {
    const strLen = str.length;
    const limit = len * 2 + delimiter.length;

    return strLen >= limit ? str.substring(0, len) + delimiter + str.substring(strLen - len, strLen) : str;
}

export type InvalidateQueryKeys = readonly (readonly string[])[];

export function invalidateWithDelay(queryClient: QueryClient, queryKeys: InvalidateQueryKeys, delayMs = 500): void {
    queryKeys.forEach(key => void queryClient.invalidateQueries({ queryKey: [...key] }));
    setTimeout(() => {
        queryKeys.forEach(key => void queryClient.invalidateQueries({ queryKey: [...key] }));
    }, delayMs);
}

export const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all active:scale-[0.98] motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
    {
        defaultVariants: {
            size: 'default',
            variant: 'default',
        },
        variants: {
            size: {
                default: 'h-9 px-4 py-2 has-[>svg]:px-3',
                icon: 'size-9',
                lg: 'h-10 px-6 has-[>svg]:px-4',
                sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5',
            },
            variant: {
                default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
                destructive:
                    'bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20',
                ghost: 'hover:bg-accent hover:text-accent-foreground',
                link: 'text-primary underline-offset-4 hover:underline',
                outline: 'border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
                secondary: 'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
            },
        },
    },
);
