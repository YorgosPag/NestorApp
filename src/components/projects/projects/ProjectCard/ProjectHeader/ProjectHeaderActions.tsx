'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Eye,
  Edit,
  MoreVertical,
  Star,
  Share,
  Download,
  Settings
} from "lucide-react";
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectHeaderActionsProps {
    isHovered: boolean;
    isFavorite: boolean;
    setIsFavorite: (isFavorite: boolean) => void;
}

export function ProjectHeaderActions({ isHovered, isFavorite, setIsFavorite }: ProjectHeaderActionsProps) {
    return (
        <div className={cn(
            "absolute top-4 right-4 z-10 transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 bg-white/90 backdrop-blur-sm shadow-lg hover:bg-white">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>
                  <Eye className="w-4 h-4 mr-2" />
                  Προβολή Λεπτομερειών
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Edit className="w-4 h-4 mr-2" />
                  Επεξεργασία
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Share className="w-4 h-4 mr-2" />
                  Κοινοποίηση
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Download className="w-4 h-4 mr-2" />
                  Εξαγωγή Αναφοράς
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsFavorite(!isFavorite)}>
                  <Star className={cn("w-4 h-4 mr-2", isFavorite && "text-yellow-500 fill-yellow-500")} />
                  {isFavorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  Ρυθμίσεις
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
    );
}
