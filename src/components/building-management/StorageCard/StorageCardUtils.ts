
'use client';

import { Package, Zap, Shield, Lightbulb } from 'lucide-react';
import type { StorageUnit, StorageType } from '@/types/storage';

export const formatPrice = (price: number) => {
    return new Intl.NumberFormat('el-GR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0
    }).format(price);
};

export const formatArea = (area: number) => {
    return `${area.toFixed(2)} m²`;
};

export const getPricePerSqm = (unit: StorageUnit) => {
    if (unit.area === 0) return 0;
    return Math.round(unit.price / unit.area);
};

export const getFeatureIcon = (feature: string) => {
    if (feature.toLowerCase().includes('ηλεκτρικό') || feature.toLowerCase().includes('ρεύμα')) return Zap;
    if (feature.toLowerCase().includes('φωτισμός')) return Lightbulb;
    if (feature.toLowerCase().includes('ασφάλεια') || feature.toLowerCase().includes('προστασία')) return Shield;
    if (feature.toLowerCase().includes('πρίζα') || feature.toLowerCase().includes('φόρτιση')) return Zap;
    return Package;
};

export const getTypeColor = (type: StorageType) => {
    return type === 'storage' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300';
};
