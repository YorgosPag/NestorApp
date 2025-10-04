
'use client';

import React from 'react';

interface PropertyEditPanelProps {
    selectedPolygonId: string | null;
}

export function PropertyEditPanel({ selectedPolygonId }: PropertyEditPanelProps) {
    return (
        <div className="space-y-4">
            <h4 className="font-medium">Ιδιότητες Polygon</h4>
            {selectedPolygonId ? (
                <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                        Επιλεγμένο: {selectedPolygonId}
                    </p>
                    {/* Property editing controls will go here */}
                </div>
            ) : (
                <p className="text-sm text-muted-foreground">
                    Επιλέξτε ένα polygon για επεξεργασία
                </p>
            )}
        </div>
    );
}
