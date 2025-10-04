'use client';

import React from 'react';
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Building2,
  Landmark,
  Star,
  Phone,
  Mail,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName, getContactInitials, getPrimaryEmail, getPrimaryPhone } from '@/types/contacts';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';


interface ContactListItemProps {
  contact: Contact;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

const typeInfoMap = {
    individual: { icon: Users, color: 'border-blue-200 bg-blue-50 text-blue-700' },
    company: { icon: Building2, color: 'border-purple-200 bg-purple-50 text-purple-700' },
    service: { icon: Landmark, color: 'border-green-200 bg-green-50 text-green-700' }
};

export function ContactListItem({
    contact,
    isSelected,
    isFavorite,
    onSelect,
    onToggleFavorite
}: ContactListItemProps) {
    const { icon: Icon, color } = typeInfoMap[contact.type];
    const displayName = getContactDisplayName(contact);
    const initials = getContactInitials(contact);
    const email = getPrimaryEmail(contact);
    const phone = getPrimaryPhone(contact);

    return (
        <TooltipProvider>
            <div
                className={cn(
                    "relative p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md group",
                    isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-sm"
                    : "border-border hover:border-blue-300 bg-card hover:bg-accent/50"
                )}
                onClick={onSelect}
            >
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite();
                            }}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 p-1"
                        >
                            <Star
                                className={cn(
                                    "w-4 h-4 transition-colors",
                                    isFavorite
                                    ? "text-yellow-500 fill-yellow-500"
                                    : "text-gray-400 hover:text-yellow-500"
                                )}
                            />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{isFavorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}</p>
                    </TooltipContent>
                </Tooltip>

                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 text-sm">
                        <AvatarFallback className={color}>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                         <h4 className="font-medium text-sm text-foreground truncate">{displayName}</h4>
                         <p className="text-xs text-muted-foreground truncate">{contact.type === 'individual' ? (contact as any).profession : (contact as any).vatNumber || ''}</p>
                    </div>
                </div>

                <div className="mt-2 pt-2 border-t space-y-1">
                    {email && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{email}</span>
                        </div>
                    )}
                    {phone && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span className="truncate">{phone}</span>
                        </div>
                    )}
                </div>

                {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
                )}
            </div>
        </TooltipProvider>
    );
}

