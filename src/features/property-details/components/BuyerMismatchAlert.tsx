'use client';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

export function BuyerMismatchAlert() {
  const iconSizes = useIconSizes();

  return (
    <Alert variant="destructive">
      <AlertCircle className={iconSizes.sm} />
      <AlertTitle>Προειδοποίηση</AlertTitle>
      <AlertDescription>
        Αναντιστοιχία αγοραστή. Το ID του πελάτη δεν βρέθηκε στις επαφές.
      </AlertDescription>
    </Alert>
  );
}
