'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUnitsByOwner } from '@/services/units.service';
import type { Property } from '@/types/property-viewer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Home, Eye, Plus } from 'lucide-react';

interface CustomerPropertiesTableProps {
    contactId: string;
    onAddUnit: () => void;
}

export function CustomerPropertiesTable({ contactId, onAddUnit }: CustomerPropertiesTableProps) {
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchProperties = async () => {
            if (!contactId) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const ownedProperties = await getUnitsByOwner(contactId);
                setProperties(ownedProperties);
            } catch (error) {
                console.error("Failed to fetch customer properties:", error);
                setProperties([]);
            } finally {
                setLoading(false);
            }
        };

        fetchProperties();
    }, [contactId]);
    
    if (loading) {
        return null; // Avoid hydration mismatch by rendering nothing during initial load
    }
    
    const handleViewUnit = (unitId: string) => {
        router.push(`/units?unitId=${unitId}`);
    };

    return (
        <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Home className="w-4 h-4 text-muted-foreground"/>
                    Ακίνητα Πελάτη ({properties.length})
                </h4>
                <Button variant="outline" size="sm" onClick={onAddUnit}>
                    <Plus className="w-4 h-4 mr-2"/>
                    Προσθήκη Ακινήτου
                </Button>
            </div>
            {properties.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-4 border rounded-lg">
                    Αυτός ο πελάτης δεν έχει καταχωρημένα ακίνητα.
                </div>
            ) : (
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Κωδικός</TableHead>
                                <TableHead>Τύπος</TableHead>
                                <TableHead>Εμβαδόν</TableHead>
                                <TableHead>Κτίριο</TableHead>
                                <TableHead className="text-right">Ενέργειες</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {properties.map(prop => (
                                <TableRow key={prop.id}>
                                    <TableCell className="font-medium">{prop.name}</TableCell>
                                    <TableCell>{prop.type}</TableCell>
                                    <TableCell>{prop.area ? `${prop.area} τ.μ.` : '-'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{prop.building}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => handleViewUnit(prop.id)}>
                                            <Eye className="w-4 h-4 mr-2"/>
                                            Προβολή
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}