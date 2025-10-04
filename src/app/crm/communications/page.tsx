'use client';

import { useState, useEffect } from 'react';
import CommunicationsHistory from "@/components/CommunicationsHistory";

export default function CrmCommunicationsPage() {
  const [contactId, setContactId] = useState<string | null>(null);

  // In a real app, you would have a way to select a contact
  // For now, we can show all communications for a default/mock contact
  // or show a message to select one.
  useEffect(() => {
    // For demonstration, let's pick the first contact from a service or mock
    // This would be replaced with actual contact selection logic
    // For now, we'll leave it null to show the default message
  }, []);

  return (
    <div className="p-6">
       <div className="bg-white dark:bg-card rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-2">Ιστορικό Επικοινωνιών</h1>
        <p className="text-muted-foreground mb-4">
          Προβολή όλων των καταγεγραμμένων επικοινωνιών. Επιλέξτε μια επαφή για να δείτε το ιστορικό της.
        </p>
        {/* Placeholder for a contact selector */}
        {/* <ContactSelector onSelectContact={setContactId} /> */}
        
        <CommunicationsHistory contactId={contactId} />
      </div>
    </div>
  );
}
