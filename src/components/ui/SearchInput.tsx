import type { InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  value: string;
  onChangeValue: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  sizeVariant?: "sm" | "md";
  className?: string;
}

export function SearchInput({
  value,
  onChangeValue,
  onClear,
  placeholder = "Search...",
  sizeVariant = "md",
  className = "",
  ...props
}: SearchInputProps) {
  return (
    <div className={`search-input-wrap search-input-wrap--${sizeVariant} ${className}`}>
      <Search className="search-input-icon" size={sizeVariant === "sm" ? 14 : 16} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChangeValue(e.target.value)}
        placeholder={placeholder}
        className="search-input-field"
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="search-input-clear"
          aria-label="Clear search"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export default SearchInput;
