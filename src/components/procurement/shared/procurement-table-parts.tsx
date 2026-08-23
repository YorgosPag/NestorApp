'use client';

/**
 * Τα δύο κοινά κομμάτια των πινάκων procurement που οδηγούν σε λεπτομέρεια.
 *
 * Τέσσερα components — `ContactPurchaseOrdersSection` · `ContactQuotesSection` ·
 * `ContactRfqInvitesSection` · `RfqList` — έγραφαν **γράμμα προς γράμμα** την ίδια
 * κλικαμπλε γραμμή (ίδιες κλάσεις hover/cursor, ίδιο κελί-βέλος στο τέλος) και το
 * ίδιο μήνυμα φόρτωσης/κενού. Το CHECK 3.28 τα μετρούσε ως **τρία ζεύγη κλώνων**
 * με κέντρο το `ContactPurchaseOrdersSection`.
 *
 * ⚠️ **Το βέλος ζει ΜΕΣΑ στη γραμμή, όχι στον καλούντα.** Είναι η οπτική υπόσχεση
 * «αυτή η γραμμή πάει κάπου» και ταιριάζει **ένα προς ένα** με το `onClick`:
 * χωριστά, μια νέα γραμμή θα μπορούσε να είναι κλικαμπλε **χωρίς** το βέλος —
 * δηλαδή affordance που υπόσχεται με το ποντίκι και δεν το λέει στο μάτι.
 *
 * ⚠️ **Το `key` μένει στον καλούντα**, όπως απαιτεί το React: το component δεν
 * μπορεί να το διαβάσει από τα props του, και σιωπηλή απώλειά του θα γεννούσε
 * λάθος επαναχρήση κόμβων στη λίστα.
 *
 * @module components/procurement/shared/procurement-table-parts
 */

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';

export interface ProcurementRowLinkProps {
  readonly onClick: () => void;
  readonly testId?: string;
  /** Τα κελιά **πριν** από το βέλος. */
  readonly children: React.ReactNode;
}

/** Γραμμή πίνακα που οδηγεί σε λεπτομέρεια, με το βέλος στο τέλος. */
export function ProcurementRowLink({ onClick, testId, children }: ProcurementRowLinkProps) {
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onClick} data-testid={testId}>
      {children}
      <TableCell>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}

/** Μήνυμα «φορτώνει» ή «κανένα αποτέλεσμα» στη θέση του πίνακα. */
export function ProcurementTableNotice({ children }: { readonly children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

/**
 * **Το λεξιλόγιο του πίνακα, από ΕΝΑ σημείο.**
 *
 * Τα τέσσερα components έγραφαν το **ίδιο οκτάγραμμο** μπλοκ εισαγωγής των
 * primitives (`Table` … `TableRow`). Μαζί με τα υπόλοιπα κοινά imports (Card,
 * Button, Plus, useTranslation) το προοίμιο έφτανε τις **14 ταυτόσημες γραμμές**
 * — αρκετά για να το μετρήσει το CHECK 3.28 ως κλώνο.
 *
 * ⚠️ **Δεν είναι barrel «για ευκολία».** Το module ήδη ορίζει τα δύο κομμάτια που
 * συνθέτουν αυτούς τους πίνακες· τα primitives ταξιδεύουν **μαζί τους**, ώστε ο
 * καταναλωτής να ζητά **ένα** λεξιλόγιο και όχι δύο. Η επαναξαγωγή είναι ζωντανή
 * (και οι τέσσερις καταναλωτές τη χρησιμοποιούν), άρα δεν τροφοδοτεί το CHECK 3.30.
 */
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
