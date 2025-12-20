'use client';

import { Home, Building, Warehouse, Store, Car, Briefcase } from 'lucide-react';


export const getPropertyTypeIcon = (type: string) => {
    const typeUpper = type.toUpperCase();
    
    if (typeUpper.includes('ΔΙΑΜΈΡΙΣΜΑ') || typeUpper.includes('ΣΤΟΎΝΤΙΟ') || typeUpper.includes('ΓΚΑΡΣΟΝΙΈΡΑ')) {
        return Home;
    }
    if (typeUpper.includes('ΚΑΤΆΣΤΗΜΑ') || typeUpper.includes('ΕΜΠΟΡΙΚΌ')) {
        return Store;
    }
    if (typeUpper.includes('ΓΡΑΦΕΊΟ')) {
        return Briefcase;
    }
    if (typeUpper.includes('ΜΕΖΟΝΈΤΑ') || typeUpper.includes('ΟΙΚΟΔΟΜΉ')) {
        return Building;
    }
    if (typeUpper.includes('ΑΠΟΘΉΚΗ') || typeUpper.includes('ΑΠΟΘ')) {
        return Warehouse;
    }
    if (typeUpper.includes('PARKING') || typeUpper.includes('ΧΏΡΟΣ ΣΤΆΘΜΕΥΣΗΣ') || typeUpper.includes('ΓΚΑΡΆΖ')) {
        return Car;
    }
    
    // Default to Home for residential properties
    return Home;
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