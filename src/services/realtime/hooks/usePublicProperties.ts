'use client';

import { useState, useEffect, useRef } from 'react';
import { query, where, collection, onSnapshot, type QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { LISTED_COMMERCIAL_STATUSES } from '@/constants/commercial-statuses';
import type { RealtimeUnit } from '../types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('usePublicProperties');

export function usePublicProperties() {
  const [properties, setProperties] = useState<RealtimeUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    try {
      const constraints: QueryConstraint[] = [
        where('commercialStatus', 'in', LISTED_COMMERCIAL_STATUSES as unknown as string[]),
      ];
      // tenant-scope-exempt: δημόσια αγγελία — το query ΕΙΝΑΙ ο κανόνας (CHECK 3.35 / ADR-747)
      //
      // ⚠️ Το σχόλιο έλεγε «γραμμή 797» — η πραγματική είναι **953** (μετρήθηκε
      // 2026-08-09, ADR-777 Α20). Ο αριθμός γραμμής σε σχόλιο παλιώνει σιωπηλά·
      // κράτα το **όνομα** του αρχείου και το **κριτήριο**, όχι τη θέση.
      //
      // 🔶 ΑΝΟΙΧΤΟ (ADR-777 Α20): οι κανόνες απέκτησαν **δεύτερο** δημόσιο σκέλος
      // πάνω στο `offerKinds`, ώστε ένα ακίνητο **μόνο προς αντιπαροχή** να είναι
      // ορατό — αυτό το query δεν το ρωτά ακόμη. Θα το κάνει η **οθόνη 2** (Α3).
      //
      // Το `firestore.rules:953` επιτρέπει ανώνυμη ανάγνωση ακριβώς όταν
      // `resource.data.commercialStatus in ['for-sale','for-rent','for-sale-and-rent']`,
      // και το `LISTED_COMMERCIAL_STATUSES` είναι **η ίδια τριάδα**. Δηλαδή το φίλτρο
      // εδώ δεν είναι «κάτι που ξεχάστηκε να γίνει tenant-scoped» — είναι η ακριβής
      // αντιγραφή του δημόσιου κανόνα, όπως απαιτεί το συμβόλαιο των rules tests
      // («a list test must send the same query the production client sends»).
      //
      // ⚠️ Αν αλλάξει το ένα, ΠΡΕΠΕΙ να αλλάξει και το άλλο: μια αγγελία που μπαίνει
      // στη λίστα χωρίς να μπει στον κανόνα ⇒ ολόκληρο το query απορρίπτεται (τα rules
      // ΔΕΝ είναι φίλτρα — ADR-745 §9.5).
      const q = query(collection(db, COLLECTIONS.PROPERTIES), ...constraints);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            name: (doc.data().name as string) || '',
            buildingId: (doc.data().buildingId as string) || null,
            type: doc.data().type as string | undefined,
            status: doc.data().status as string | undefined,
            area: doc.data().area as number | undefined,
            floor: doc.data().floor as number | undefined,
            createdAt: doc.data().createdAt as string | undefined,
            updatedAt: doc.data().updatedAt as string | undefined,
          } as RealtimeUnit));

          setProperties(docs);
          setLoading(false);
          logger.info('Public properties loaded', { count: docs.length });
        },
        (err: Error) => {
          logger.error('Public properties error', { error: err.message });
          setError(err.message);
          setLoading(false);
        }
      );

      unsubRef.current = unsubscribe;
      return () => unsubscribe();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Setup error', { error: msg });
      setError(msg);
      setLoading(false);
    }
  }, []);

  return { properties, loading, error };
}
