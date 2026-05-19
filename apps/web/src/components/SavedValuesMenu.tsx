import { Button, TextInput } from '@solana/design-system';
import { Bookmark, ChevronDown } from 'lucide-react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSavedValues } from '@/contexts/SavedValuesContext';

interface SavedFieldProps {
    datalistId: string;
    label: string;
    onChange: (value: string) => void;
    onSave: (value: string) => void;
    placeholder: string;
    savedValues: string[];
    value: string;
}

function SavedField({ datalistId, label, onChange, onSave, placeholder, savedValues, value }: SavedFieldProps) {
    return (
        <div>
            <TextInput
                action={
                    <Button
                        disabled={!value.trim()}
                        onClick={() => onSave(value)}
                        size="sm"
                        type="button"
                        variant="secondary"
                    >
                        Save
                    </Button>
                }
                description={`${savedValues.length} saved`}
                label={label}
                list={datalistId}
                onChange={event => onChange(event.target.value)}
                placeholder={placeholder}
                value={value}
            />
            <datalist id={datalistId}>
                {savedValues.map(savedValue => (
                    <option key={savedValue} value={savedValue} />
                ))}
            </datalist>
        </div>
    );
}

export function SavedValuesMenu() {
    const {
        clearSavedValues,
        defaultEscrow,
        defaultMint,
        defaultReceipt,
        escrows,
        mints,
        receipts,
        rememberEscrow,
        rememberMint,
        rememberReceipt,
        setDefaultEscrow,
        setDefaultMint,
        setDefaultReceipt,
    } = useSavedValues();
    const savedCount = escrows.length + mints.length + receipts.length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    iconLeft={<Bookmark />}
                    iconRight={<ChevronDown className="opacity-60" />}
                    size="sm"
                    variant="secondary"
                >
                    Saved Values
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-3">
                <DropdownMenuLabel className="flex items-center justify-between gap-3 px-0">
                    <span>Saved Values</span>
                    <span className="text-xs font-normal text-muted-foreground">{savedCount} total</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="space-y-3">
                    <SavedField
                        datalistId="saved-values-escrows"
                        label="Default Escrow"
                        onChange={setDefaultEscrow}
                        onSave={rememberEscrow}
                        placeholder="Escrow PDA"
                        savedValues={escrows}
                        value={defaultEscrow}
                    />
                    <SavedField
                        datalistId="saved-values-mints"
                        label="Default Mint"
                        onChange={setDefaultMint}
                        onSave={rememberMint}
                        placeholder="SPL token mint"
                        savedValues={mints}
                        value={defaultMint}
                    />
                    <SavedField
                        datalistId="saved-values-receipts"
                        label="Default Receipt"
                        onChange={setDefaultReceipt}
                        onSave={rememberReceipt}
                        placeholder="Receipt PDA"
                        savedValues={receipts}
                        value={defaultReceipt}
                    />
                    <Button
                        disabled={savedCount === 0}
                        onClick={clearSavedValues}
                        size="sm"
                        type="button"
                        variant="secondary"
                    >
                        Clear Saved
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
