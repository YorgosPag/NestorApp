/**
 * =============================================================================
 * useLinkMint — δημιουργία συνδέσμου ΣΤΟ ΚΛΙΚ (ADR-315 Α11)
 * =============================================================================
 *
 * 🔴 **Πριν**: ο διάλογος γεννούσε ενεργό σύνδεσμο 72 ωρών **σε κάθε άνοιγμα** — ακόμη κι αν δεν
 * στελνόταν ποτέ. Με ορατή λίστα συνδέσμων αυτό θα γέμιζε την οθόνη ορφανούς, και κάθε ορφανός
 * είναι ζωντανό διαπιστευτήριο. **Τώρα** (πρότυπο Dropbox «Copy link» / Box «Create and Copy
 * Shared Link» / DocSend ονομασμένοι σύνδεσμοι): ο σύνδεσμος γεννιέται **όταν ο άνθρωπος τον ζητήσει**.
 *
 * 🔑 **Single-flight**: δύο γρήγορα κλικ = **ένας** σύνδεσμος (το δεύτερο παίρνει το ίδιο Promise).
 * 🔑 Το `preSubmit` (π.χ. PDF του showcase — ακριβό) τρέχει **μία** φορά ανά άνοιγμα διαλόγου και
 * ξαναχρησιμοποιείται για κάθε επόμενο σύνδεσμο προς άλλον παραλήπτη.
 *
 * @module components/sharing/link-management/useLinkMint
 */

'use client';

import { useCallback, useRef, useState } from 'react';

import { draftToCreatePolicy } from '@/components/ui/sharing/panels/link-token/draft-mapping';
import type { LinkTokenDraft } from '@/components/ui/sharing/panels/link-token/types';
import { UnifiedSharingService } from '@/services/sharing/unified-sharing.service';
import type { CreateShareInput, ShareEntityType } from '@/types/sharing';

/** Ό,τι μόνο αυτή η συνεδρία του διαλόγου ξέρει — το διακριτικό **δεν ξαναδείχνεται** ποτέ. */
export interface MintedShare {
  readonly shareId: string;
  readonly token: string;
  readonly url: string;
  /** Το μήνυμα προς τον παραλήπτη — προσυμπληρώνει τα κανάλια αποστολής αυτού του συνδέσμου. */
  readonly note?: string;
}

type EntityMeta = Pick<CreateShareInput, 'showcaseMeta' | 'contactMeta' | 'fileMeta'>;

export interface UseLinkMintOptions extends EntityMeta {
  readonly entityType: ShareEntityType;
  readonly entityId: string;
  readonly preSubmit?: () => Promise<EntityMeta>;
}

export interface UseLinkMintResult {
  /** Ο τελευταίος σύνδεσμος αυτής της συνεδρίας, ή `null`. */
  readonly minted: MintedShare | null;
  readonly minting: boolean;
  /** Γεννά σύνδεσμο με την πολιτική του προσχεδίου. Idempotent όσο είναι σε πτήση. */
  readonly mint: (draft: LinkTokenDraft) => Promise<MintedShare>;
  /** «Νέος σύνδεσμος για άλλον παραλήπτη» — ο προηγούμενος **μένει** ενεργός. */
  readonly startOver: () => void;
  /** Κλείσιμο διαλόγου: ξεχνά τα πάντα, και την κρυφή μνήμη του `preSubmit`. */
  readonly reset: () => void;
}

function shareUrlOf(token: string): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/shared/${token}`;
}

export function useLinkMint({ entityType, entityId, preSubmit, ...meta }: UseLinkMintOptions): UseLinkMintResult {
  const [minted, setMinted] = useState<MintedShare | null>(null);
  const [minting, setMinting] = useState(false);
  const inFlight = useRef<Promise<MintedShare> | null>(null);
  const preSubmitCache = useRef<Promise<EntityMeta> | null>(null);
  const { showcaseMeta, contactMeta, fileMeta } = meta;

  const create = useCallback(
    async (draft: LinkTokenDraft): Promise<MintedShare> => {
      const extra = preSubmit ? await (preSubmitCache.current ??= preSubmit()) : undefined;
      const result = await UnifiedSharingService.createShare({
        entityType,
        entityId,
        ...draftToCreatePolicy(draft),
        showcaseMeta: extra?.showcaseMeta ?? showcaseMeta,
        contactMeta: extra?.contactMeta ?? contactMeta,
        fileMeta: extra?.fileMeta ?? fileMeta,
      });
      const note = draft.note.trim() || undefined;
      return { shareId: result.shareId, token: result.token, url: shareUrlOf(result.token), ...(note ? { note } : {}) };
    },
    [entityType, entityId, preSubmit, showcaseMeta, contactMeta, fileMeta],
  );

  const mint = useCallback(
    (draft: LinkTokenDraft): Promise<MintedShare> => {
      if (inFlight.current) return inFlight.current;
      setMinting(true);
      const flight = create(draft)
        .then((next) => {
          setMinted(next);
          return next;
        })
        .catch((error: unknown) => {
          preSubmitCache.current = null; // ένα αποτυχημένο PDF δεν μένει «κρυφή απάντηση»
          throw error;
        })
        .finally(() => {
          inFlight.current = null;
          setMinting(false);
        });
      inFlight.current = flight;
      return flight;
    },
    [create],
  );

  const startOver = useCallback(() => setMinted(null), []);

  const reset = useCallback(() => {
    setMinted(null);
    preSubmitCache.current = null;
  }, []);

  return { minted, minting, mint, startOver, reset };
}
