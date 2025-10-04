'use client';

import { Home, Building, Warehouse, Store, Car, Briefcase } from 'lucide-react';

export const getStatusColor = (status: string) => {
    switch (status) {
        case 'for-sale': return 'bg-blue-500';
        case 'sold': return 'bg-red-500';
        case 'for-rent': return 'bg-yellow-500';
        case 'rented': return 'bg-green-500';
        case 'reserved': return 'bg-purple-500';
        default: return 'bg-gray-400';
    }
};

export const getStatusLabel = (status: string) => {
    switch (status) {
        case 'for-sale': return 'Προς Πώληση';
        case 'sold': return 'Πουλημένο';
        case 'for-rent': return 'Προς Ενοικίαση';
        case 'rented': return 'Ενοικιασμένο';
        case 'reserved': return 'Κρατημένο';
        default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
};

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