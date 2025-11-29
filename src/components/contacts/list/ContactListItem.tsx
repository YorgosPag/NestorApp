'use client';

import React, { useState } from 'react';
import { ContactBadge } from '@/core/badges';
import {
  Users,
  Building2,
  Landmark,
  Star,
  Phone,
  Mail,
  Loader2,
  Archive,
  X,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName, getContactInitials, getPrimaryEmail, getPrimaryPhone } from '@/types/contacts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getContactCardBackgrounds, getTypography } from '@/components/ui/theme/ThemeComponents';


interface ContactListItemProps {
  contact: Contact;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  isTogglingFavorite?: boolean;
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
    onToggleFavorite,
    isTogglingFavorite = false
}: ContactListItemProps) {
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
    const { icon: Icon, color } = typeInfoMap[contact.type];
    const displayName = getContactDisplayName(contact);
    const initials = getContactInitials(contact);
    const email = getPrimaryEmail(contact);
    const phone = getPrimaryPhone(contact);
    const isArchived = (contact as any)?.status === 'archived';

    // Debug: log photoURL for this contact
    if ((contact as any).photoURL) {
        console.log(`Contact ${displayName} has photoURL:`, (contact as any).photoURL?.substring(0, 50) + '...');
    }

    // Get centralized contact card backgrounds
    const cardBackgrounds = getContactCardBackgrounds();

    return (
        <TooltipProvider>
            <div
                className={cn(
                    "relative p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md group",
                    isArchived && `opacity-60 ${cardBackgrounds.archived}`,
                    isSelected
                    ? `border-blue-500 ${cardBackgrounds.selected} shadow-sm`
                    : `border-border hover:border-blue-300 ${cardBackgrounds.default}`
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
                            disabled={isTogglingFavorite}
                            className={cn(
                                "absolute top-2 right-2 transition-opacity z-10 p-1",
                                isSelected || isFavorite
                                    ? "opacity-100"
                                    : "opacity-0 group-hover:opacity-100"
                            )}
                        >
                            {isTogglingFavorite ? (
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            ) : (
                                <Star
                                    className={cn(
                                        "w-4 h-4 transition-colors",
                                        isFavorite
                                        ? "text-yellow-500 fill-yellow-500"
                                        : "text-gray-400 hover:text-yellow-500"
                                    )}
                                />
                            )}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{isFavorite ? 'Αφαίρεση από αγαπημένα' : 'Προσθήκη στα αγαπημένα'}</p>
                    </TooltipContent>
                </Tooltip>

                <div className="flex items-center gap-3">
                    <Avatar
                        className={cn(
                            "h-10 w-10 text-sm",
                            (contact as any).photoURL && "cursor-pointer hover:opacity-80 transition-opacity"
                        )}
                        onClick={(e) => {
                            if ((contact as any).photoURL) {
                                e.stopPropagation();
                                setIsPhotoModalOpen(true);
                            }
                        }}
                    >
                        {(contact as any).photoURL ? (
                            <AvatarImage
                                src={(contact as any).photoURL}
                                alt={`${displayName} φωτογραφία`}
                                className="object-cover"
                                onError={(e) => {
                                    console.log('Photo load error for contact:', contact.id, (contact as any).photoURL);
                                }}
                                onLoad={() => {
                                    console.log('Photo loaded successfully for contact:', contact.id);
                                }}
                            />
                        ) : null}
                        <AvatarFallback className={color}>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                         <h4 className={cn(getTypography('titleMedium'), "truncate")}>{displayName}</h4>
                         <p className={cn(getTypography('bodySmall'), "truncate")}>{contact.type === 'individual' ? (contact as any).profession : (contact as any).vatNumber || ''}</p>
                    </div>
                </div>

                <div className="mt-2 pt-2 border-t space-y-1">
                    {email && (
                        <div className={cn("flex items-center gap-2", getTypography('labelMedium'))}>
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{email}</span>
                        </div>
                    )}
                    {phone && (
                        <div className={cn("flex items-center gap-2", getTypography('labelMedium'))}>
                            <Phone className="w-3 h-3" />
                            <span className="truncate">{phone}</span>
                        </div>
                    )}
                    {isArchived && (
                        <div className="flex items-center gap-2 mt-1">
                            <ContactBadge
                                status="archived"
                                size="sm"
                                className="text-xs bg-orange-100 text-orange-700 border-orange-200"
                            />
                        </div>
                    )}
                </div>

                {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
                )}
            </div>

            {/* Photo View Modal */}
            <Dialog open={isPhotoModalOpen} onOpenChange={setIsPhotoModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] p-0">
                    <div className="relative">
                        <button
                            onClick={() => setIsPhotoModalOpen(false)}
                            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="flex items-center justify-center bg-black/5 min-h-[400px]">
                            <img
                                src={(contact as any).photoURL}
                                alt={`${displayName} φωτογραφία`}
                                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                            />
                        </div>
                        <div className="p-4 bg-white border-t">
                            <h3 className="font-semibold text-lg text-gray-900">{displayName}</h3>
                            <p className="text-sm text-gray-600">Φωτογραφία επαφής</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
}

