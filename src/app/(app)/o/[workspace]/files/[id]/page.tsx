import { fileViewerHref } from '@/lib/files/file-viewer-route';
import { redirect } from '@/lib/workspace/server-navigation';

interface FileViewerRedirectProps {
  params: Promise<{ workspace: string; id: string }>;
}

/**
 * Η **μορφή διαδρομής** της διεύθυνσης ενός αρχείου (ADR-899 §9 θέμα 10).
 *
 * Ανακατευθύνει `/o/<χώρος>/files/:id` → `/o/<χώρος>/files?file=:id`, **μέσα στον ίδιο χώρο** (σύνορο
 * διακομιστή, CHECK 3.61) — ίδιο πρότυπο με το `contacts/[id]`.
 *
 * 🔴 **Γιατί υπάρχει**: το ευρετήριο της καθολικής αναζήτησης γράφει για κάθε αρχείο `routeTemplate: '/files/{id}'`
 * (`config/search-index-core.ts`), αλλά η διαδρομή **δεν υπήρχε** — το κλικ σε αρχείο στην αναζήτηση δεν είχε
 * σελίδα να ανοίξει. Η ανακατεύθυνση θεραπεύει **και** τις ήδη ευρετηριασμένες εγγραφές, χωρίς καμία εγγραφή
 * στην παραγωγή. Τι δείχνεται για κάθε ταυτότητα (Κάδος, ξένος χώρος, ανύπαρκτο) το αποφασίζει **ο θεατής**
 * (`lib/files/file-viewer-outcome`), όχι αυτή η σελίδα.
 */
export default async function FileViewerRedirect({ params }: FileViewerRedirectProps) {
  const { workspace, id } = await params;
  redirect(fileViewerHref(id), workspace);
}
