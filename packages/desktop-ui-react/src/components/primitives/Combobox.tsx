import { useMemo, useState, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import { Input } from "./Input";

export interface ComboboxOption {
  value: string;
  label: ReactNode;
  searchText?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  label?: ReactNode;
  placeholder?: string;
  emptyLabel?: ReactNode;
  disabled?: boolean;
  className?: string;
  onValueChange?: (value: string) => void;
}

export function Combobox({
  options,
  value,
  label,
  placeholder = "Search",
  emptyLabel = "No options",
  disabled,
  className,
  onValueChange
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => {
      const text = (option.searchText ?? (typeof option.label === "string" ? option.label : option.value)).toLowerCase();
      return text.includes(normalized);
    });
  }, [options, query]);
  const selectedText = selected ? (typeof selected.label === "string" ? selected.label : selected.value) : "";

  return (
    <div className={cn("df-combobox", className)}>
      <Input
        label={label}
        disabled={disabled}
        placeholder={selected ? selectedText : placeholder}
        value={open ? query : selected ? selectedText : query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        suffix={<span aria-hidden="true">⌄</span>}
      />
      {open && !disabled ? (
        <div className="df-combobox__panel" role="listbox">
          {filtered.length ? (
            filtered.map((option) => (
              <button
                key={option.value}
                className={cn("df-combobox__option", option.value === value && "is-selected")}
                type="button"
                disabled={option.disabled}
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onValueChange?.(option.value);
                  setQuery("");
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="df-combobox__empty">{emptyLabel}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
