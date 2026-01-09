'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { getUnitsByOwner } from '@/services/units.service';
import type { Property } from '@/types/property-viewer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CommonBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { Eye, Plus } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

interface CustomerPropertiesTableProps {
    contactId: string;
    onAddUnit: () => void;
}

export function CustomerPropertiesTable({ contactId, onAddUnit }: CustomerPropertiesTableProps) {
    const iconSizes = useIconSizes();
    const { quick } = useBorderTokens();
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
                    <UnitIcon className={`${iconSizes.sm} ${unitColor}`}/>
                    Ακίνητα Πελάτη ({properties.length})
                </h4>
                <Button variant="outline" size="sm" onClick={onAddUnit}>
                    <Plus className={`${iconSizes.sm} mr-2`}/>
                    Προσθήκη Ακινήτου
                </Button>
            </div>
            {properties.length === 0 ? (
                <div className={`text-center text-sm text-muted-foreground py-4 ${quick.card}`}>
                    Αυτός ο πελάτης δεν έχει καταχωρημένα ακίνητα.
                </div>
            ) : (
                <div className={quick.card}>
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
                                        <CommonBadge
                                          status="company"
                                          customLabel={prop.building}
                                          variant="outline"
                                          size="sm"
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => handleViewUnit(prop.id)}>
                                            <Eye className={`${iconSizes.sm} mr-2`}/>
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