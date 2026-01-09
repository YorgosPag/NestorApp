'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Train, Bus, Car, Building, GraduationCap, ShoppingCart, TrendingUp, Euro } from 'lucide-react';
// 🏢 ENTERPRISE: Centralized navigation entities
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';

export function LocationAnalyticsGrid() {
    const iconSizes = useIconSizes();
    // 🏢 ENTERPRISE: Use centralized unit icon for area quality
    const AreaQualityIcon = NAVIGATION_ENTITIES.unit.icon;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Συγκοινωνίες</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <Train className={iconSizes.sm} />
                                Μετρό Ευαγγελισμός
                            </span>
                            <span className="text-sm font-medium">300m</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <Bus className={iconSizes.sm} />
                                Στάση λεωφορείου
                            </span>
                            <span className="text-sm font-medium">50m</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <Car className={iconSizes.sm} />
                                Πάρκινγκ
                            </span>
                            <span className="text-sm font-medium">150m</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Υπηρεσίες</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <Building className={iconSizes.sm} />
                                Νοσοκομείο
                            </span>
                            <span className="text-sm font-medium">800m</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <GraduationCap className={iconSizes.sm} />
                                Σχολεία
                            </span>
                            <span className="text-sm font-medium">400m</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <ShoppingCart className={iconSizes.sm} />
                                Σούπερ μάρκετ
                            </span>
                            <span className="text-sm font-medium">200m</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Αξιολόγηση Περιοχής</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <TrendingUp className={iconSizes.sm} />
                                Επενδυτικός δείκτης
                            </span>
                            <span className="text-sm font-medium text-green-600">8.5/10</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <AreaQualityIcon className={iconSizes.sm} />
                                Ποιότητα περιοχής
                            </span>
                            <span className="text-sm font-medium text-green-600">9.2/10</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                                <Euro className={iconSizes.sm} />
                                Τιμές ακινήτων
                            </span>
                            <span className="text-sm font-medium text-blue-600">€3,200/m²</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
