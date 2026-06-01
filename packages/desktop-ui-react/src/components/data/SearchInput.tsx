import { forwardRef } from "react";
import { Input, type InputProps } from "../primitives/Input";

export interface SearchInputProps extends Omit<InputProps, "type"> {
  searchLabel?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({ searchLabel = "Search", placeholder = "Search", ...props }, ref) => (
  <Input ref={ref} type="search" aria-label={props["aria-label"] ?? searchLabel} placeholder={placeholder} prefix={<span className="df-search-input__icon" aria-hidden="true" />} {...props} />
));

SearchInput.displayName = "SearchInput";
