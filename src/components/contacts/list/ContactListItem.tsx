'use client';

import React, { useState, useEffect } from 'react';
import { ContactBadge } from '@/core/badges';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { PhotoPreviewModal, usePhotoPreviewModal, openContactAvatarModal, openGalleryPhotoModal } from '@/core/modals';
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

    // 🔥 FORCE RE-RENDER: Key-based avatar invalidation
    const [avatarKey, setAvatarKey] = useState(0);

    // Listen για force avatar re-render events
    useEffect(() => {
      const handleForceRerender = (event: CustomEvent) => {
        const { contactId } = event.detail;
        if (contactId === contact.id) {
          console.log('🔄 CONTACT LIST ITEM: Force re-rendering avatar for contact', contactId);
          setAvatarKey(prev => prev + 1); // Force re-render με νέο key
        }
      };

      window.addEventListener('forceAvatarRerender', handleForceRerender as EventListener);
      return () => {
        window.removeEventListener('forceAvatarRerender', handleForceRerender as EventListener);
      };
    }, [contact.id]);
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

    const rawAvatarImageUrl = getAvatarImageUrl();

    // 🔥 ULTIMATE FIX: Cache buster για browser image cache ΜΟΝΟ για Individuals
    // ΠΡΟΒΛΗΜΑ: Browser cache κρατάει τις Firebase images για 1 χρόνο (Cache-Control: public, max-age=31536000)
    // ΛΥΣΗ: Προσθήκη timestamp στην URL ώστε ο browser να φορτώσει fresh εικόνα
    // TESTED: 2025-12-04 - Τελική λύση μετά από 12+ ώρες debugging με browser cache
    // ΣΗΜΕΙΩΣΗ: Cache buster μόνο όταν ΠΡΑΓΜΑΤΙΚΑ χρειάζεται
    const needsCacheBuster = contact.type === 'individual' &&
                             Array.isArray((contact as any).multiplePhotoURLs) &&
                             (contact as any).multiplePhotoURLs.length === 0;

    const avatarImageUrl = rawAvatarImageUrl
        ? (needsCacheBuster
            ? `${rawAvatarImageUrl}?v=${contact.updatedAt || Date.now()}`
            : rawAvatarImageUrl)
        : undefined;

    // Handler για άνοιγμα photo modal με smart gallery logic για όλους τους τύπους
    const handleAvatarClick = () => {
        if (!avatarImageUrl) return;

        // 🎯 SMART LOGIC: Gallery navigation για Individual με multiplePhotoURLs
        if (contact.type === 'individual' && (contact as any).multiplePhotoURLs?.length > 0) {
            const multiplePhotos = (contact as any).multiplePhotoURLs;
            const currentPhotoIndex = multiplePhotos.findIndex((url: string) => url === avatarImageUrl);
            const photoIndex = currentPhotoIndex >= 0 ? currentPhotoIndex : 0;

            // Άνοιγμα με gallery navigation (βελάκια working!)
            openGalleryPhotoModal(photoModal, contact, photoIndex);

        } else if (contact.type === 'company') {
            // 🎯 NEW: Gallery navigation για Company [logoURL, photoURL]
            const logoURL = (contact as any).logoURL;
            const photoURL = (contact as any).photoURL; // Representative photo
            const galleryPhotos = [logoURL, photoURL].filter(Boolean); // Remove null/undefined

            if (galleryPhotos.length > 1) {
                // Multiple photos available - use gallery navigation
                const currentPhotoIndex = galleryPhotos.findIndex((url: string) => url === avatarImageUrl);
                const photoIndex = currentPhotoIndex >= 0 ? currentPhotoIndex : 0;

                // Create temporary contact with multiplePhotoURLs for gallery
                const galleryContact = { ...contact, multiplePhotoURLs: galleryPhotos };
                openGalleryPhotoModal(photoModal, galleryContact, photoIndex);
            } else {
                // Single photo fallback
                const photoType = avatarImageUrl === logoURL ? 'logo' : 'profile';
                openContactAvatarModal(photoModal, contact, photoType);
            }

        } else if (contact.type === 'service') {
            // 🎯 NEW: Gallery navigation για Service [logoURL, photoURL]
            const logoURL = (contact as any).logoURL;
            const photoURL = (contact as any).photoURL; // Representative photo
            const galleryPhotos = [logoURL, photoURL].filter(Boolean); // Remove null/undefined

            if (galleryPhotos.length > 1) {
                // Multiple photos available - use gallery navigation
                const currentPhotoIndex = galleryPhotos.findIndex((url: string) => url === avatarImageUrl);
                const photoIndex = currentPhotoIndex >= 0 ? currentPhotoIndex : 0;

                // Create temporary contact with multiplePhotoURLs for gallery
                const galleryContact = { ...contact, multiplePhotoURLs: galleryPhotos };
                openGalleryPhotoModal(photoModal, galleryContact, photoIndex);
            } else {
                // Single photo fallback
                const photoType = avatarImageUrl === logoURL ? 'logo' : 'profile';
                openContactAvatarModal(photoModal, contact, photoType);
            }

        } else {
            // Fallback για Individual χωρίς multiple photos ή other types
            openContactAvatarModal(photoModal, contact, 'profile');
        }
    };

    // Get centralized contact card backgrounds
    const cardBackgrounds = getContactCardBackgrounds();

    return (
        <TooltipProvider>
            {/* 📱 MOBILE COMPACT LAYOUT - Responsive Design */}
            <div
                className={cn(
                    // Base layout
                    "relative rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md group",
                    // 🎯 RESPONSIVE PADDING: Compact on mobile, normal on desktop
                    "p-2 sm:p-3",
                    // Color states
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

                {/* 📱 RESPONSIVE LAYOUT: Mobile Compact vs Desktop Standard */}
                <div className="block">
                    {/* 🎯 MOBILE SWIPEABLE LAYOUT (< 640px) */}
                    <div className="sm:hidden">
                        {/* Container with absolute width constraint */}
                        <div className="flex items-center gap-2 w-full">
                            {/* Fixed Avatar on the left - never scrolls */}
                            <div
                                onClick={avatarImageUrl ? handleAvatarClick : undefined}
                                className={cn("shrink-0", avatarImageUrl && "cursor-pointer")}
                            >
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={avatarImageUrl} alt={displayName} />
                                    <AvatarFallback className="text-xs bg-blue-100">{initials}</AvatarFallback>
                                </Avatar>
                            </div>

                            {/* Scrollable content with explicit width calculation */}
                            <div
                                className="overflow-x-auto scrollbar-hide"
                                style={{
                                    width: 'calc(100vw - 120px)', // Full viewport minus avatar, padding, margins
                                    scrollBehavior: 'smooth'
                                }}
                            >
                                <div className="flex items-center gap-3" style={{ width: 'max-content' }}>
                                    {/* Section 1: Name Only (no badges on mobile) */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="font-medium text-sm whitespace-nowrap">{displayName}</span>
                                        {isArchived && <Archive className="w-3 h-3 text-muted-foreground" />}
                                    </div>

                                    {/* Section 2: Phone */}
                                    {phone && (
                                        <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
                                            <Phone className="w-3 h-3" />
                                            <span className="whitespace-nowrap">{phone}</span>
                                        </div>
                                    )}

                                    {/* Section 3: Email */}
                                    {email && (
                                        <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
                                            <Mail className="w-3 h-3" />
                                            <span className="whitespace-nowrap">{email}</span>
                                        </div>
                                    )}

                                    {/* Section 4: Additional Info */}
                                    {contact.type === 'individual' && (contact as any).profession && (
                                        <div className="shrink-0 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full whitespace-nowrap">
                                            {(contact as any).profession}
                                        </div>
                                    )}
                                    {(contact.type === 'company' || contact.type === 'service') && (contact as any).vatNumber && (
                                        <div className="shrink-0 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full whitespace-nowrap">
                                            ΑΦΜ: {(contact as any).vatNumber}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 🖥️ DESKTOP STANDARD LAYOUT (>= 640px) */}
                    <div className="hidden sm:block">
                        <EntityDetailsHeader
                            key={`contact-list-item-${contact.id}-${avatarKey}`}
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
                    </div>
                </div>


                {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full" />
                )}
            </div>

            {/* ✅ Κεντρικοποιημένο Photo Preview Modal */}
            <PhotoPreviewModal {...photoModal.modalProps} />
        </TooltipProvider>
    );
}

