'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

export function CriticalPathCard() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    Κρίσιμα Σημεία
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div>
                            <p className="font-medium text-orange-900">Ηλ/Μηχ Εγκαταστάσεις</p>
                            <p className="text-sm text-orange-700">Επηρεάζει την παράδοση</p>
                        </div>
                        <Badge variant="outline" className="bg-orange-100 text-orange-700">
                            5 ημέρες καθυστέρηση
                        </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <div>
                            <p className="font-medium text-yellow-900">Τελικές Εργασίες</p>
                            <p className="text-sm text-yellow-700">Εξαρτάται από προηγούμενο</p>
                        </div>
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                            Αναμονή
                        </Badge>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}