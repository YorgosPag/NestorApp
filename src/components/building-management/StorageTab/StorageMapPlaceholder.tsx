'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

export function StorageMapPlaceholder() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Χάρτης Αποθηκών & Parking</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-96 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                    <div className="text-center">
                        <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">Χάρτης αποθηκών & θέσεων στάθμευσης</p>
                        <p className="text-sm text-gray-400 mt-2">Θα αναπτυχθεί σύντομα</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}