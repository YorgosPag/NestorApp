'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Share } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

interface LocationInfoCardProps {
    building: { name: string; address?: string, city?: string };
    coordinates: { lat: number, lng: number };
}

export function LocationInfoCard({ building, coordinates }: LocationInfoCardProps) {
    const iconSizes = useIconSizes();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MapPin className={iconSizes.md} />
                    Στοιχεία Τοποθεσίας
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <Label className="text-sm font-medium">Διεύθυνση</Label>
                            <p className="text-sm text-muted-foreground mt-1">
                                {building.address}, {building.city}
                            </p>
                        </div>
                        <div>
                            <Label className="text-sm font-medium">Συντεταγμένες</Label>
                            <p className="text-sm text-muted-foreground mt-1">
                                {coordinates.lat}°N, {coordinates.lng}°E
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                                <MapPin className={`${iconSizes.sm} mr-2`} />
                                Οδηγίες μετάβασης
                            </Button>
                            <Button variant="outline" size="sm">
                                <Share className={`${iconSizes.sm} mr-2`} />
                                Κοινοποίηση τοποθεσίας
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <Label className="text-sm font-medium">Πληροφορίες Περιοχής</Label>
                            <div className="mt-2 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Τύπος περιοχής:</span>
                                    <span>Κεντρικό - Εμπορικό</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Συντ. δόμησης:</span>
                                    <span>3.6</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Μέγιστο ύψος:</span>
                                    <span>27m (9 όροφοι)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
