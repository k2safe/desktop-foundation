import {
  forwardRef,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type ForwardedRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type SelectHTMLAttributes
} from "react";
import { cn } from "../../utils/cn";

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  placeholder?: string;
  options: SelectOption[];
  fullWidth?: boolean;
}

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) {
    ref.current = value;
  }
}

function normalizeValue(value: SelectHTMLAttributes<HTMLSelectElement>["value"] | SelectHTMLAttributes<HTMLSelectElement>["defaultValue"]) {
  if (Array.isArray(value)) return String(value[0] ?? "");
  if (value === undefined || value === null) return "";
  return String(value);
}

function optionText(option: SelectOption) {
  if (typeof option.label === "string" || typeof option.label === "number") return option.label;
  return option.value;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      hint,
      error,
      placeholder,
      options,
      fullWidth = true,
      id,
      value,
      defaultValue,
      onChange,
      onFocus,
      onBlur,
      disabled,
      required,
      name,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const labelId = label ? `${selectId}-label` : undefined;
    const buttonId = `${selectId}-button`;
    const listboxId = `${selectId}-listbox`;
    const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;
    const nativeRef = useRef<HTMLSelectElement | null>(null);
    const rootRef = useRef<HTMLSpanElement | null>(null);
    const [open, setOpen] = useState(false);
    const [internalValue, setInternalValue] = useState(() => normalizeValue(defaultValue) || (placeholder ? "" : options.find((option) => !option.disabled)?.value ?? ""));
    const selectedValue = value === undefined ? internalValue : normalizeValue(value);
    const enabledOptions = useMemo(() => options.filter((option) => !option.disabled), [options]);
    const selectedOption = options.find((option) => option.value === selectedValue);
    const [highlightedValue, setHighlightedValue] = useState(selectedOption?.value ?? enabledOptions[0]?.value ?? "");
    const hasValue = Boolean(selectedOption) || selectedValue !== "";

    useEffect(() => {
      if (!open) return;
      setHighlightedValue(selectedOption?.value ?? enabledOptions[0]?.value ?? "");
    }, [enabledOptions, open, selectedOption]);

    useEffect(() => {
      if (!open) return;

      function handlePointerDown(event: PointerEvent) {
        if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
      }

      function handleKeyDown(event: globalThis.KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
      }

      document.addEventListener("pointerdown", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("pointerdown", handlePointerDown);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [open]);

    function emitChange(nextValue: string, event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>) {
      if (disabled) return;
      if (value === undefined) setInternalValue(nextValue);
      if (nativeRef.current) nativeRef.current.value = nextValue;
      setOpen(false);
      if (nativeRef.current && onChange) {
        onChange({ ...event, target: nativeRef.current, currentTarget: nativeRef.current } as unknown as ChangeEvent<HTMLSelectElement>);
      }
    }

    function emitFocus(event: FocusEvent<HTMLButtonElement>) {
      if (nativeRef.current && onFocus) {
        onFocus({ ...event, target: nativeRef.current, currentTarget: nativeRef.current } as unknown as FocusEvent<HTMLSelectElement>);
      }
    }

    function emitBlur(event: FocusEvent<HTMLButtonElement>) {
      if (nativeRef.current && onBlur) {
        onBlur({ ...event, target: nativeRef.current, currentTarget: nativeRef.current } as unknown as FocusEvent<HTMLSelectElement>);
      }
    }

    function moveHighlight(offset: number) {
      if (!enabledOptions.length) return;
      const currentIndex = Math.max(
        0,
        enabledOptions.findIndex((option) => option.value === highlightedValue)
      );
      const nextIndex = (currentIndex + offset + enabledOptions.length) % enabledOptions.length;
      setHighlightedValue(enabledOptions[nextIndex].value);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      if (disabled) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        moveHighlight(event.key === "ArrowDown" ? 1 : -1);
      }
      if ((event.key === "Enter" || event.key === " ") && open) {
        event.preventDefault();
        const option = enabledOptions.find((item) => item.value === highlightedValue);
        if (option) emitChange(option.value, event);
      }
    }

    return (
      <div className={cn("df-field", fullWidth && "df-field--full")}>
        {label ? (
          <label id={labelId} className="df-field__label" htmlFor={buttonId}>
            {label}
          </label>
        ) : null}
        <span ref={rootRef} className={cn("df-select-wrap", Boolean(error) && "is-invalid", disabled && "is-disabled")}>
          <select
            ref={(node) => {
              nativeRef.current = node;
              assignRef(ref, node);
            }}
            id={selectId}
            className="df-select__native"
            aria-hidden="true"
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            disabled={disabled}
            name={name}
            required={required}
            tabIndex={-1}
            value={selectedValue}
            onChange={() => undefined}
            {...props}
          >
            {placeholder ? (
              <option value="" disabled={required}>
                {placeholder}
              </option>
            ) : null}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {optionText(option)}
              </option>
            ))}
          </select>
          <button
            id={buttonId}
            className={cn("df-select-control", !hasValue && "is-placeholder", className)}
            type="button"
            role="combobox"
            aria-controls={listboxId}
            aria-describedby={describedBy}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-invalid={Boolean(error)}
            aria-labelledby={labelId ? `${labelId} ${buttonId}` : undefined}
            disabled={disabled}
            onBlur={emitBlur}
            onClick={() => setOpen((current) => !current)}
            onFocus={emitFocus}
            onKeyDown={handleKeyDown}
          >
            <span className="df-select__value">{selectedOption?.label ?? placeholder ?? selectedValue}</span>
            <span className="df-select__chevron" aria-hidden="true" />
          </button>
          {open ? (
            <span id={listboxId} className="df-select__panel" role="listbox" aria-labelledby={labelId}>
              {placeholder ? (
                <button
                  className={cn("df-select__option", selectedValue === "" && "is-selected", highlightedValue === "" && "is-highlighted")}
                  disabled={required}
                  role="option"
                  type="button"
                  aria-selected={selectedValue === ""}
                  onClick={(event) => emitChange("", event)}
                  onMouseEnter={() => setHighlightedValue("")}
                >
                  <span>{placeholder}</span>
                  {selectedValue === "" ? <span className="df-select__option-check" aria-hidden="true" /> : null}
                </button>
              ) : null}
              {options.map((option) => (
                <button
                  key={option.value}
                  className={cn("df-select__option", option.value === selectedValue && "is-selected", option.value === highlightedValue && "is-highlighted")}
                  disabled={option.disabled}
                  role="option"
                  type="button"
                  aria-selected={option.value === selectedValue}
                  onClick={(event) => emitChange(option.value, event)}
                  onMouseEnter={() => setHighlightedValue(option.value)}
                >
                  <span>{option.label}</span>
                  {option.value === selectedValue ? <span className="df-select__option-check" aria-hidden="true" /> : null}
                </button>
              ))}
            </span>
          ) : null}
        </span>
        {error ? (
          <span id={`${selectId}-error`} className="df-field__error">
            {error}
          </span>
        ) : hint ? (
          <span id={`${selectId}-hint`} className="df-field__hint">
            {hint}
          </span>
        ) : null}
      </div>
    );
  }
);

Select.displayName = "Select";
