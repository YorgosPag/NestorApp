/**
 * 🏢 ENTERPRISE Search System Types
 * Unified interfaces για όλα τα search components της εφαρμογής
 *
 * @version 1.0.0
 * @author Enterprise Team
 * @compliance CLAUDE.md Protocol
 */

export interface BaseSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export interface SearchInputProps extends BaseSearchProps {
  debounceMs?: number;
  maxLength?: number;
  showClearButton?: boolean;
  onClear?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface SearchFieldProps extends BaseSearchProps {
  label?: string;
  labelIcon?: boolean;
  id?: string;
}

export interface EnterpriseSearchProps extends SearchInputProps {
  variant?: 'default' | 'compact' | 'enterprise';
  autoComplete?: string;
  'aria-label'?: string;
}

export type SearchVariant = 'default' | 'compact' | 'enterprise';

export interface SearchConfig {
  debounceDelay: number;
  maxLength: number;
  placeholderDefault: string;
  iconSize: number;
  iconPosition: string;
  paddingLeft: string;
}