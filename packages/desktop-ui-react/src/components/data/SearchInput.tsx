import { forwardRef } from "react";
import { useLocale } from "../../locale";
import { Input, type InputProps } from "../primitives/Input";

export interface SearchInputProps extends Omit<InputProps, "type"> {
  searchLabel?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({ searchLabel, placeholder, ...props }, ref) => {
  const { t } = useLocale();
  const resolvedSearchLabel = searchLabel ?? t("search.label");
  const resolvedPlaceholder = placeholder ?? t("search.placeholder");

  return (
    <Input
      ref={ref}
      type="search"
      aria-label={props["aria-label"] ?? resolvedSearchLabel}
      placeholder={resolvedPlaceholder}
      prefix={<span className="df-search-input__icon" aria-hidden="true" />}
      {...props}
    />
  );
});

SearchInput.displayName = "SearchInput";
