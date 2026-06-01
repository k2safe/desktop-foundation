import { forwardRef } from "react";
import { Input, type InputProps } from "../primitives/Input";

export interface SearchInputProps extends Omit<InputProps, "type"> {
  searchLabel?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({ searchLabel = "Search", placeholder = "Search", ...props }, ref) => (
  <Input ref={ref} type="search" placeholder={placeholder} prefix={<span className="df-search-input__icon" aria-hidden="true">{searchLabel.slice(0, 1)}</span>} {...props} />
));

SearchInput.displayName = "SearchInput";
