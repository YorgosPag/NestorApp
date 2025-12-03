'use client';

import React from 'react';
import { ContactBadge } from '@/core/badges';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { PhotoPreviewModal, usePhotoPreviewModal, openContactAvatarModal } from '@/core/modals';
import {
  Users,
  Building2,
  Landmark,
  Star,
  Phone,
  Mail,
  Loader2,
  Archive,
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
    individual: { icon: Users },
    company: { icon: Building2 },
    service: { icon: Landmark }
};

export function ContactListItem({
    contact,
    isSelected,
    isFavorite,
    onSelect,
    onToggleFavorite,
    isTogglingFavorite = false
}: ContactListItemProps) {
    const photoModal = usePhotoPreviewModal();
    const { icon: Icon } = typeInfoMap[contact.type];
    const displayName = getContactDisplayName(contact);
    const initials = getContactInitials(contact);
    const email = getPrimaryEmail(contact);
    const phone = getPrimaryPhone(contact);
    const isArchived = (contact as any)?.status === 'archived';

    // 🎯 SMART AVATAR LOGIC: Different URL based on contact type (same as ContactDetailsHeader)
    const getAvatarImageUrl = () => {
        switch (contact.type) {
            case 'individual':
                return (contact as any).photoURL; // Personal photo
            case 'company':
                return (contact as any).logoURL; // Company logo
            case 'service':
                return (contact as any).logoURL; // Service logo (NOT photoURL which is for representative)
            default:
                return (contact as any).photoURL;
        }
    };

    const avatarImageUrl = getAvatarImageUrl();

    // Handler για άνοιγμα photo modal
    const handleAvatarClick = () => {
        if (!avatarImageUrl) return;

        // Καθορίζουμε τον τύπο φωτογραφίας
        const photoType = contact.type === 'company' || contact.type === 'service' ? 'logo' : 'profile';

        openContactAvatarModal(photoModal, contact, photoType);
    };

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

                {/* Contact Header - EntityDetailsHeader with centralized ContactBadge */}
                <EntityDetailsHeader
                    icon={Icon}
                    title={displayName}
                    subtitle={contact.type === 'individual' ? (contact as any).profession : (contact as any).vatNumber || ''}
                    avatarImageUrl={avatarImageUrl}
                    onAvatarClick={avatarImageUrl ? handleAvatarClick : undefined}
                    variant="compact"
                    className="mb-2"
                >
                    {/* Centralized ContactBadge */}
                    <div className="flex gap-2 mt-2 mb-2">
                        <ContactBadge status={contact.type as any} variant="outline" size="sm" />
                        {isArchived && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">
                                <Archive className="w-3 h-3 mr-1" />
                                Αρχειοθετημένο
                            </span>
                        )}
                    </div>

                    {/* Contact Info */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                            {email && (
                                <div className={cn("flex items-center gap-2", getTypography('labelSmall'))}>
                                    <Mail className="w-3 h-3" />
                                    <span className="truncate">{email}</span>
                                </div>
                            )}
                            {phone && (
                                <div className={cn("flex items-center gap-2", getTypography('labelSmall'))}>
                                    <Phone className="w-3 h-3" />
                                    <span className="truncate">{phone}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </EntityDetailsHeader>


                {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                )}
            </div>

            {/* ✅ Κεντρικοποιημένο Photo Preview Modal */}
            <PhotoPreviewModal {...photoModal.modalProps} />
        </TooltipProvider>
    );
}

