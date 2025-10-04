'use client';

import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface QuickSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  placeholder?: string;
}

export function QuickSearch({ searchTerm, onSearchChange, placeholder = "Search..." }: QuickSearchProps) {
  return (
    <div className="relative flex-1 max-w-xs">
      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3 h-3" />
      <Input
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-7 h-8 text-xs bg-muted/50 border-muted-foreground/20"
      />
      {searchTerm && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          onClick={() => onSearchChange('')}
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}