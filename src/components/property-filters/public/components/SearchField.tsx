'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import * as React from 'react';

interface SearchFieldProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Αποδίδει ακριβώς το ίδιο markup με το αρχικό Search section (χωρίς επιπλέον wrappers).
 */
export function SearchField({ value, onChange }: SearchFieldProps) {
  return (
    <>
      <Label htmlFor="search" className="text-sm font-medium flex items-center gap-2">
        <Search className="w-4 h-4" />
        Αναζήτηση
      </Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="search"
          placeholder="Αναζήτηση ακινήτου..."
          value={value}
          onChange={onChange}
          className="pl-9"
        />
      </div>
    </>
  );
}
