import 'server-only';

/**
 * @fileoverview **Η ΡΥΘΜΙΣΗ ΤΗΣ ΔΙΚΗΣ ΜΟΥ ΘΕΣΗΣ** — το ένα σχήμα των διαδρομών «σίγαση» και «ακολουθώ».
 * @related ADR-867 Β5 (σίγαση) · Β7 (follow) · `thread-writer.ts` (`touchOwnAudience`)
 * @module app/api/network/_shared/own-seat-route
 *
 * 🔑 **Ένα boolean, τελική κατάσταση, στη ΔΙΚΗ μου ιδιωτική πλευρά της θέσης** (Ε9) — οι δύο πράξεις είναι ακριβώς
 * αυτό: μονομερείς, χωρίς ειδοποίηση του άλλου, ιδεμποτείς (`PUT` με τιμή, ποτέ εναλλαγή). Δύο
 * χειρόγραφες διαδρομές θα ήταν **δίδυμα** (CHECK 3.28) που αποκλίνουν την ημέρα που η μία αλλάξει.
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { z } from 'zod';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type { AudienceSelfOutcome } from '@/services/network-messaging/thread-writer';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { networkRefusal, networkServerError, type NetworkActor } from './network-door';
import { threadInput } from './network-params';

export type OwnSeatField = 'muted' | 'following';

/**
 * 🔑 ADR-853 Ε3 — **ιδεμποτικό εκ κατασκευής**: `set` μιας boolean στο **δικό** του ιδιωτικό έγγραφο θέσης.
 * Η επανάληψη γράφει την **ίδια** τιμή· η αποθήκη του συνόρου θα ήταν κόστος χωρίς όφελος.
 */
export const OWN_SEAT_IDEMPOTENCY = {
  mode: 'natural',
  why: 'set boolean στο δικό του ιδιωτικό έγγραφο θέσης — η επανάληψη γράφει την ίδια τιμή',
} as const;

type ThreadRoute = { readonly params: Promise<{ threadId: string }> };

export type OwnSeatResponse<F extends OwnSeatField> = { readonly success: true } & Readonly<Record<F, boolean>>;

interface OwnSeatSpec<F extends OwnSeatField> {
  readonly field: F;
  /** Το σχήμα του σώματος — από το `network-params.ts`, όπως κάθε διαδρομή του δικτύου. */
  readonly schema: z.ZodType<Readonly<Record<F, boolean>>>;
  readonly write: (adminDb: AdminFirestore, threadId: string, uid: string, value: boolean) => Promise<AudienceSelfOutcome>;
  readonly logger: { error(message: string, meta: Record<string, unknown>): void };
  readonly failure: string;
}

/** Η απάντηση `{ success, [field]: τιμή }` — το σχήμα που ήδη δίνει η σίγαση (Β5), χωρίς αλλαγή. */
function ownSeatResponse<F extends OwnSeatField>(field: F, value: boolean): OwnSeatResponse<F> {
  const echo = { [field]: value } as Record<F, boolean>;
  return { success: true, ...echo };
}

/** Ο handler μιας διαδρομής ρύθμισης θέσης. */
export function ownSeatHandler<F extends OwnSeatField>(spec: OwnSeatSpec<F>) {
  return async (request: NextRequest, actor: NetworkActor, routeContext?: ThreadRoute) => {
    const input = await threadInput(request, routeContext, spec.schema);
    if (!input.ok) return input.response;
    const { threadId, body } = input.value;
    const value = body[spec.field];

    try {
      const outcome = await spec.write(getAdminFirestore(), threadId, actor.uid, value);
      if (outcome === 'not-audience') return networkRefusal('not-audience');
      return NextResponse.json<OwnSeatResponse<F>>(ownSeatResponse(spec.field, value));
    } catch (error) {
      return networkServerError(spec.logger, spec.failure, error, { threadId });
    }
  };
}
