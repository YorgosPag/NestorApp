'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
    return (
        <div className="p-8">
            <Card>
                <CardHeader>
                    <CardTitle>Ρυθμίσεις</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Επιλέξτε μια κατηγορία από το μενού.</p>
                </CardContent>
            </Card>
        </div>
    );
}
