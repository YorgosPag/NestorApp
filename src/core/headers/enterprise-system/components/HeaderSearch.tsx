/**
 * 🏢 HEADER SEARCH COMPONENT - ENTERPRISE
 *
 * Κεντρικοποιημένο search component για headers
 * Enterprise implementation με debouncing και responsive design
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { HeaderSearchProps } from '../types';
import { SEARCH_CONFIG, HEADER_THEME } from '../constants';

export const HeaderSearch: React.FC<HeaderSearchProps> = ({
  value = '',
  onChange,
  placeholder,
  className,
  disabled = false
}) => {
  const [localValue, setLocalValue] = useState(value);

  // Enterprise debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
      onChange?.(localValue);
    }, SEARCH_CONFIG.debounceMs);

    return () => clearTimeout(handler);
  }, [localValue, onChange]);

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const searchClasses = cn(
    "relative flex-1 min-w-0 w-full sm:min-w-[300px]",
    HEADER_THEME.components.search.default,
    className
  );

  const effectivePlaceholder = placeholder || SEARCH_CONFIG.placeholder.default;

  return (
    <div className={searchClasses}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
      <Input
        placeholder={effectivePlaceholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        disabled={disabled}
        className="pl-10 h-9"
        maxLength={SEARCH_CONFIG.maxLength}
      />
    </div>
  );
};

export default HeaderSearch;