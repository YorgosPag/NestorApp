"use client";
import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import type { SearchFieldProps } from "../types";

export function SearchField({ value, onChange }: SearchFieldProps) {
  return (
    <div className="space-y-2">
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
          onChange={(e) => onChange(e.target.value)}
          className="pl-9"
        />
      </div>
    </div>
  );
}
