
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlusCircle, Search, Filter } from "lucide-react";
import Link from "next/link";
import type { StatusFilter } from '../hooks/useObligationsList';

interface ObligationsHeaderProps {
  filters: { searchTerm: string; status: StatusFilter };
  onFilterChange: (key: 'status', value: StatusFilter) => void;
  onSearch: (term: string) => void;
}

export function ObligationsHeader({ filters, onFilterChange, onSearch }: ObligationsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-between">
      <div className="flex flex-col sm:flex-row gap-4 flex-1">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Αναζήτηση συγγραφών υποχρεώσεων..."
            value={filters.searchTerm}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Κατάσταση
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onFilterChange("status", "all")}>Όλες</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange("status", "draft")}>Προσχέδια</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange("status", "completed")}>Ολοκληρωμένες</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onFilterChange("status", "approved")}>Εγκεκριμένες</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <Link href="/obligations/new">
        <Button className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" />
          Νέα Συγγραφή Υποχρεώσεων
        </Button>
      </Link>
    </div>
  );
}

    