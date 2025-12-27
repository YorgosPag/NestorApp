'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

export function StorageMapPlaceholder() {
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();
    return (
        <Card>
            <CardHeader>
                <CardTitle>Χάρτης Αποθηκών & Parking</CardTitle>
            </CardHeader>
            <CardContent>
                <div className={`${iconSizes.xl12} bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg border border-dashed ${quick.muted} flex items-center justify-center`}>
                    <div className="text-center">
                        <MapPin className={`${iconSizes.xl3} text-muted-foreground mx-auto mb-4`} />
                        <p className="text-muted-foreground">Χάρτης αποθηκών & θέσεων στάθμευσης</p>
                        <p className="text-sm text-muted-foreground mt-2">Θα αναπτυχθεί σύντομα</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}