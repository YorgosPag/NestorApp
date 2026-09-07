'use client';

/**
 * @fileoverview **Ο ΟΡΑΤΟΣ ΕΛΕΓΧΟΣ ΤΗΣ ΣΕΙΡΑΣ** — η μία κρυφή παράμετρος γίνεται επιλογή.
 * @related ADR-777 §8.61 · lib/listings/listing-results-order.ts · ADR-001 (Radix Select)
 * @module components/search-results/filters/ResultsOrderSelect
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ.** Μέχρι σήμερα η οθόνη 2 κατέτασσε κατά `documentId`, δηλαδή —
 * επειδή τα IDs κωδικοποιούν τον συντάκτη— **κατά τάξη συντάκτη**: κάθε αγγελία ιδιώτη
 * πριν από κάθε αγγελία γραφείου, μόνιμα. Κανείς δεν το διάλεξε **και κανείς δεν
 * μπορούσε να το δει**. Αυτό το χειριστήριο είναι το δεύτερο μισό της θεραπείας: η
 * σειρά δεν αρκεί να γίνει δίκαιη, πρέπει να γίνει **ορατή** (Καν. ΕΕ 2019/1150 ·
 * Οδηγία ΕΕ 2019/2161).
 *
 * 🔑 **ΟΙ ΕΠΙΛΟΓΕΣ ΔΙΑΒΑΖΟΝΤΑΙ ΑΠΟ ΤΟ SSoT, ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΕΔΩ.** Ο κατάλογος είναι το
 * {@link LISTING_ORDERS}, και ο πίνακας ετικετών είναι `Record<ListingOrder, …>` —
 * δηλαδή μια νέα σειρά **δεν μεταγλωττίζεται** χωρίς ετικέτα, και μια ετικέτα για σειρά
 * που δεν υπάρχει **δεν μεταγλωττίζεται** καθόλου. Το χειριστήριο δεν *μπορεί* να
 * προσφέρει κατάταξη που κανείς δεν δήλωσε.
 *
 * ⚠️ **Καμία `useState`** — ίδια πειθαρχία με κάθε άλλο χειριστήριο αυτού του φακέλου:
 * η τιμή έρχεται από τη διεύθυνση και γράφεται πίσω σε αυτήν, μέσω του **ενός** γραφέα
 * (`useFilterCommit`). Δύο αντίγραφα θα διαφωνούσαν στο πρώτο «πίσω» του περιηγητή.
 *
 * ⚠️ **Καμία `SelectItem value=""`** (CHECK 3.48): το Radix δεσμεύει το κενό αλφαριθμητικό
 * και ένα τέτοιο στοιχείο ρίχνει **ολόκληρη** την επιφάνεια σε χρόνο εκτέλεσης. Τα
 * κλειδιά του {@link LISTING_ORDERS} είναι όλα μη κενά — και δεν υπάρχει «καμία σειρά».
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LISTING_ORDERS,
  type ListingOrder,
} from '@/lib/listings/listing-results-order';
import { cn } from '@/lib/utils';

interface ResultsOrderSelectProps {
  readonly order: ListingOrder;
  readonly onChange: (order: ListingOrder) => void;
  readonly className?: string;
}

export function ResultsOrderSelect({ order, onChange, className }: ResultsOrderSelectProps) {
  const { t } = useTranslation(['search-filters']);

  /**
   * **Η ετικέτα κάθε σειράς** — κυριολεκτικές κλήσεις `t('…')`, επίτηδες.
   *
   * ⚠️ Ένα `t(\`search-filters:filters.sort.${order}\`)` —ή ακόμη και ένας πίνακας **κλειδιών**
   * που περνά σε `t(variable)`— θα ήταν **αόρατο στην πύλη CHECK 3.8**, που σαρώνει
   * κυριολεκτικές κλήσεις. Κλειδί που καμία πύλη δεν βλέπει είναι κλειδί που μπορεί να
   * λείψει χωρίς να το μάθει κανείς — και ο άνθρωπος θα έβλεπε το **ωμό κλειδί** στο μενού.
   *
   * 🔑 **`Record<ListingOrder, …>`**: νέα σειρά **δεν μεταγλωττίζεται** χωρίς ετικέτα,
   * ετικέτα για ανύπαρκτη σειρά **δεν μεταγλωττίζεται** καθόλου. Ο μεταγλωττιστής
   * κρατά τον κατάλογο και τις ετικέτες σε συμφωνία — όχι η προσοχή κάποιου.
   */
  const labels: Record<ListingOrder, string> = {
    newest: t('search-filters:filters.sort.newest'),
    priceAsc: t('search-filters:filters.sort.priceAsc'),
    priceDesc: t('search-filters:filters.sort.priceDesc'),
  };

  return (
    <Select value={order} onValueChange={(value) => onChange(value as ListingOrder)}>
      <SelectTrigger
        // 🔑 **Η ετικέτα είναι προσβάσιμη, όχι ζωγραφισμένη**: η γραμμή φίλτρων είναι
        //    ήδη πυκνή, και ένα ορατό «Ταξινόμηση:» δίπλα στην επιλεγμένη τιμή θα
        //    επαναλάμβανε πληροφορία που η ίδια η τιμή δίνει. Ο αναγνώστης οθόνης όμως
        //    **οφείλει** να ξέρει τι είναι αυτό το χειριστήριο.
        aria-label={t('search-filters:filters.sort.label')}
        className={cn('w-52', className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LISTING_ORDERS.map((key) => (
          <SelectItem key={key} value={key}>
            {labels[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
