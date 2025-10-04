'use client';
import { Separator } from '@/components/ui/separator';

export function LimitedInfoNotice() {
  return (
    <>
      <Separator />
      <div className="text-center p-4 text-muted-foreground">
        <p className="text-xs">Περιορισμένες πληροφορίες για δημόσια προβολή</p>
        <p className="text-xs mt-1">Για περισσότερες λεπτομέρειες επικοινωνήστε μαζί μας</p>
      </div>
    </>
  );
}
