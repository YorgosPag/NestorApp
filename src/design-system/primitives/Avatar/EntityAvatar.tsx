'use client';

/**
 * 🏢 ENTERPRISE ENTITY AVATAR - Primitive Component
 *
 * The ONE renderer for an identity image: a photo, a logo, or — when there is no image — a monogram in a
 * stable tone. Before it, eight screens each assembled `Avatar` + `AvatarFallback` by hand with eight
 * different fallbacks (gradient + icon, `bg-muted` + icon, `bg-primary/10` + initials, a char-sum colour…).
 *
 * - `person`       → circle, `object-cover`
 * - `organization` → rounded square, `object-contain` on a light tile (a logo is drawn for a light ground;
 *                    a dark transparent logo on the dark theme's card would vanish — Slack/Attio do the same)
 * - no image / still loading / failed → initials (`getInitials`, ADR-209) in `monogramToneClass(seed)`
 *
 * ⚠️ NOT Radix `AvatarImage`: it decides "loaded" by preloading `new Image()` with `src` only — which
 * (a) ignores `loading="lazy"`, so 100 off-screen cards download 100 images up front, and (b) on a 2x
 * screen fetches the 1x file to probe, then the 2x file from `srcset`: two downloads per avatar. Here the
 * real `<img>` is the only request; the monogram sits underneath until it paints.
 *
 * Decorative by default (`aria-hidden`): every consumer prints the name beside it. With `onActivate` it
 * becomes a real `<button>` carrying the caller's accessible label.
 *
 * @see ADR-190 §Display — identity image SSoT
 */

import React from 'react';
import { Building2, User, type LucideIcon } from 'lucide-react';

import { identityImageSource } from '@/lib/media/identity-image-source';
import { cn } from '@/lib/utils';
import { getInitials } from '@/types/contacts/helpers';

import type { EntityAvatarKind, EntityAvatarSize, EntityAvatarSpec } from './entity-avatar.types';
import { monogramToneClass } from './monogram-tone';
import { useImageStatus } from './useImageStatus';

/** CSS box per size — the pixel value drives the image request, the class draws the box. One table. */
const ENTITY_AVATAR_BOX: Readonly<Record<EntityAvatarSize, { readonly px: number; readonly box: string; readonly text: string }>> = {
  sm: { px: 32, box: 'h-8 w-8', text: 'text-xs' },
  md: { px: 40, box: 'h-10 w-10', text: 'text-sm' },
  lg: { px: 48, box: 'h-12 w-12', text: 'text-base' },
};

const SHAPE: Readonly<Record<EntityAvatarKind, { readonly frame: string; readonly tile: string; readonly image: string }>> = {
  person: { frame: 'rounded-full', tile: '', image: 'object-cover' },
  // `bg-white` is deliberate in BOTH themes: it is the ground the logo was designed on, not a surface colour.
  organization: { frame: 'rounded-md', tile: 'bg-white ring-1 ring-inset ring-border', image: 'object-contain p-0.5' },
};

export interface EntityAvatarProps extends EntityAvatarSpec {
  readonly size?: EntityAvatarSize;
  /** Makes the avatar a button (e.g. open the photo viewer) */
  readonly onActivate?: () => void;
  /** Accessible name of the button — required for meaning when `onActivate` is set */
  readonly activateLabel?: string;
  readonly className?: string;
}

/** A name with no letters (empty, digits, «&») has no initials ⇒ the kind's silhouette, never an empty disc. */
const SILHOUETTE: Readonly<Record<EntityAvatarKind, LucideIcon>> = { person: User, organization: Building2 };

function Monogram({ name, kind }: { readonly name: string; readonly kind: EntityAvatarKind }) {
  const initials = getInitials(name);
  if (initials) return <>{initials}</>;
  const Silhouette = SILHOUETTE[kind];
  return <Silhouette className="h-1/2 w-1/2" aria-hidden />;
}

interface AvatarFaceProps {
  readonly spec: EntityAvatarSpec;
  readonly size: EntityAvatarSize;
  readonly className?: string;
  readonly decorative: boolean;
}

function AvatarFace({ spec, size, className, decorative }: AvatarFaceProps) {
  const box = ENTITY_AVATAR_BOX[size];
  const shape = SHAPE[spec.kind];
  const source = spec.imageUrl ? identityImageSource(spec.imageUrl, box.px) : null;
  const { status, imgRef, onLoad, onError } = useImageStatus(source?.src);
  const painted = status === 'loaded';

  return (
    <span
      data-entity-avatar={spec.kind}
      data-avatar-state={source ? status : 'monogram'}
      aria-hidden={decorative || undefined}
      className={cn('relative inline-flex shrink-0 select-none overflow-hidden', box.box, shape.frame, painted && shape.tile, className)}
    >
      {!painted && (
        <span className={cn('flex h-full w-full items-center justify-center font-semibold', box.text, monogramToneClass(spec.seed))}>
          <Monogram name={spec.name} kind={spec.kind} />
        </span>
      )}
      {source && status !== 'error' && (
        // `src`/`srcSet` already come from the optimizer via the public `getImageProps` (identityImageSource),
        // which also decides which URLs may NOT go through it — one decision, not a second one in `<Image>`.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={source.src}
          srcSet={source.srcSet}
          width={box.px}
          height={box.px}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={onLoad}
          onError={onError}
          className={cn('absolute inset-0 h-full w-full', shape.image, !painted && 'opacity-0')}
        />
      )}
    </span>
  );
}

export function EntityAvatar({ size = 'md', onActivate, activateLabel, className, ...spec }: EntityAvatarProps) {
  if (!onActivate) return <AvatarFace spec={spec} size={size} className={className} decorative />;
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={activateLabel}
      className={cn('shrink-0 rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
    >
      <AvatarFace spec={spec} size={size} decorative />
    </button>
  );
}

EntityAvatar.displayName = 'EntityAvatar';
