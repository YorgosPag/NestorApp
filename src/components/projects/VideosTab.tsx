'use client';

import React from 'react';
import { Video, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HOVER_BORDER_EFFECTS, GROUP_HOVER_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';

export function VideosTab() {
    const iconSizes = useIconSizes();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Videos Έργου</h3>
                <Button>
                    <Upload className={`${iconSizes.sm} mr-2`} />
                    Ανέβασμα Video
                </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((index) => (
                    <div
                        key={index}
                        className={`aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border ${HOVER_BORDER_EFFECTS.BLUE} transition-colors cursor-pointer group`}
                    >
                        <div className="text-center">
                            <Video className={`${iconSizes.xl} text-muted-foreground ${GROUP_HOVER_PATTERNS.BLUE_ICON_ON_GROUP} mx-auto mb-2`} />
                            <p className="text-sm text-muted-foreground">Προσθήκη Video</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
