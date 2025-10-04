'use client';

import React from 'react';
import { Video, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function VideosTab() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Videos Έργου</h3>
                <Button>
                    <Upload className="w-4 h-4 mr-2" />
                    Ανέβασμα Video
                </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((index) => (
                    <div
                        key={index}
                        className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border hover:border-blue-400 transition-colors cursor-pointer group"
                    >
                        <div className="text-center">
                            <Video className="w-8 h-8 text-muted-foreground group-hover:text-blue-500 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Προσθήκη Video</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
