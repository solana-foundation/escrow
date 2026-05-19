'use client';

import { Button } from '@solana/design-system/button';
import { Select, SelectItem } from '@solana/design-system/select';
import { TextInput } from '@solana/design-system/text-input';

interface FormFieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    hint?: string;
    required?: boolean;
    readOnly?: boolean;
    type?: string;
    autoFillValue?: string;
    onAutoFill?: (v: string) => void;
    autoFillLabel?: string;
}

export function FormField({
    label,
    value,
    onChange,
    placeholder,
    hint,
    required,
    readOnly,
    type = 'text',
    autoFillValue = '',
    onAutoFill,
    autoFillLabel = 'Autofill',
}: FormFieldProps) {
    return (
        <TextInput
            label={label}
            description={hint}
            action={
                onAutoFill ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => onAutoFill(autoFillValue)}
                        disabled={!autoFillValue}
                    >
                        {autoFillLabel}
                    </Button>
                ) : undefined
            }
            inputClassName={readOnly ? 'opacity-60' : undefined}
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            readOnly={readOnly}
        />
    );
}

interface SelectFieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { label: string; value: string }[];
    hint?: string;
}

export function SelectField({ label, value, onChange, options, hint }: SelectFieldProps) {
    return (
        <Select label={label} description={hint} value={value} onValueChange={nextValue => onChange(nextValue ?? '')}>
            {options.map(option => (
                <SelectItem key={option.value} value={option.value}>
                    {option.label}
                </SelectItem>
            ))}
        </Select>
    );
}

export function SendButton({ label = 'Send Transaction', sending }: { label?: string; sending: boolean }) {
    return (
        <Button type="submit" loading={sending} disabled={sending} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            {sending ? 'Sending Transaction' : label}
        </Button>
    );
}
