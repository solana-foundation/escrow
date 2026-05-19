export function InstructionPanel({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <section className="rounded-lg border bg-card p-5 shadow-xs">
            <h2 className="mb-4 border-b border-border-low pb-3 text-base font-semibold text-foreground">{title}</h2>
            <div className="max-w-xl">{children}</div>
        </section>
    );
}
