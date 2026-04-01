'use client';

import { Store, Briefcase, BedSingle } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized navigation entities
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';

// =============================================================================
// 🏢 ENTERPRISE: Centralized Property Type Icons
// =============================================================================
// Icons follow enterprise standards (Zillow, Rightmove, JLL patterns)
// Single source of truth for property type icons across the application
// Building icon uses NAVIGATION_ENTITIES.building for consistency

export const getPropertyTypeIcon = (type: string) => {
    const typeUpper = type.toUpperCase();

    // 🏢 Studio / Γκαρσονιέρα (unified per enterprise UX)
    if (typeUpper.includes('ΣΤΟΎΝΤΙΟ') || typeUpper.includes('ΣΤΟΥΝΤΙΟ') ||
        typeUpper.includes('ΓΚΑΡΣΟΝΙΈΡΑ') || typeUpper.includes('ΓΚΑΡΣΟΝΙΕΡΑ') ||
        typeUpper.includes('STUDIO')) {
        return BedSingle;
    }

    // 🏢 Διαμέρισμα (apartment) - uses centralized building icon
    if (typeUpper.includes('ΔΙΑΜΈΡΙΣΜΑ') || typeUpper.includes('ΔΙΑΜΕΡΙΣΜΑ') ||
        typeUpper.includes('APARTMENT')) {
        return NAVIGATION_ENTITIES.building.icon;
    }

    // 🏠 Μεζονέτα (maisonette/house-style) - uses centralized unit icon
    if (typeUpper.includes('ΜΕΖΟΝΈΤΑ') || typeUpper.includes('ΜΕΖΟΝΕΤΑ') ||
        typeUpper.includes('MAISONETTE') || typeUpper.includes('ΟΙΚΟΔΟΜΉ')) {
        return NAVIGATION_ENTITIES.property.icon;
    }

    // 🏪 Κατάστημα (retail/shop)
    if (typeUpper.includes('ΚΑΤΆΣΤΗΜΑ') || typeUpper.includes('ΚΑΤΑΣΤΗΜΑ') ||
        typeUpper.includes('ΕΜΠΟΡΙΚΌ') || typeUpper.includes('SHOP') ||
        typeUpper.includes('RETAIL')) {
        return Store;
    }

    // 💼 Γραφείο (office)
    if (typeUpper.includes('ΓΡΑΦΕΊΟ') || typeUpper.includes('ΓΡΑΦΕΙΟ') ||
        typeUpper.includes('OFFICE')) {
        return Briefcase;
    }

    // 📦 Αποθήκη (storage) - uses centralized storage icon
    if (typeUpper.includes('ΑΠΟΘΉΚΗ') || typeUpper.includes('ΑΠΟΘΗΚΗ') ||
        typeUpper.includes('ΑΠΟΘ') || typeUpper.includes('STORAGE')) {
        return NAVIGATION_ENTITIES.storage.icon;
    }

    // 🚗 Parking - uses centralized parking icon
    if (typeUpper.includes('PARKING') || typeUpper.includes('ΧΏΡΟΣ ΣΤΆΘΜΕΥΣΗΣ') ||
        typeUpper.includes('ΓΚΑΡΆΖ') || typeUpper.includes('ΓΚΑΡΑΖ')) {
        return NAVIGATION_ENTITIES.parking.icon;
    }

    // Default to centralized building icon
    return NAVIGATION_ENTITIES.building.icon;
};

export const getPropertyTypeLabel = (type: string) => {
    return type; // The type is already a descriptive string in Greek
};

// Helper function to determine if a property type is residential
export const isResidentialProperty = (type: string): boolean => {
    const typeUpper = type.toUpperCase();
    return typeUpper.includes('ΔΙΑΜΈΡΙΣΜΑ') || 
           typeUpper.includes('ΣΤΟΎΝΤΙΟ') || 
           typeUpper.includes('ΓΚΑΡΣΟΝΙΈΡΑ') ||
           typeUpper.includes('ΜΕΖΟΝΈΤΑ');
};

// Helper function to determine if a property type is commercial
export const isCommercialProperty = (type: string): boolean => {
    const typeUpper = type.toUpperCase();
    return typeUpper.includes('ΚΑΤΆΣΤΗΜΑ') || 
           typeUpper.includes('ΓΡΑΦΕΊΟ') ||
           typeUpper.includes('ΕΜΠΟΡΙΚΌ');
};

// Helper function to get property category for filtering
export const getPropertyCategory = (type: string): 'residential' | 'commercial' | 'storage' | 'parking' | 'other' => {
    const typeUpper = type.toUpperCase();
    
    if (isResidentialProperty(type)) return 'residential';
    if (isCommercialProperty(type)) return 'commercial';
    if (typeUpper.includes('ΑΠΟΘΉΚΗ') || typeUpper.includes('ΑΠΟΘ')) return 'storage';
    if (typeUpper.includes('PARKING') || typeUpper.includes('ΓΚΑΡΆΖ')) return 'parking';
    
    return 'other';
};