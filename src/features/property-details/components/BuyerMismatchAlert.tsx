'use client';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';

export function BuyerMismatchAlert() {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Προειδοποίηση</AlertTitle>
      <AlertDescription>
        Αναντιστοιχία αγοραστή. Το ID του πελάτη δεν βρέθηκε στις επαφές.
      </AlertDescription>
    </Alert>
  );
}
