/**
 * ADR-581 — Style matchable descriptors (κανάλι `scene`).
 *
 * Καθολικά style πεδία του `BaseEntity` (ισχύουν για ΚΑΘΕ οντότητα — raw DXF ή BIM)
 * + type-extras για text/hatch. Οι τιμές διαβάζονται/γράφονται ως raw scene fields
 * (ο style cascade τα ξαναϋπολογίζει κατάντη). ΔΕΝ ξαναδηλώνουμε τιμές — μόνο τη
 * χαρτογράφηση field → (role, category, channel).
 */

import type { SceneEntity } from '../../core/commands/interfaces';
import type {
  ColorValue,
  MatchableValue,
  MatchablePropertyDescriptor,
  MatchUnit,
  MatchValueType,
  SemanticRole,
} from './match-types';
import {
  ROLE_HATCH_ANGLE,
  ROLE_HATCH_PATTERN,
  ROLE_HATCH_SCALE,
  ROLE_STYLE_COLOR,
  ROLE_STYLE_LINE_CAP,
  ROLE_STYLE_LINE_JOIN,
  ROLE_STYLE_LINE_STYLE,
  ROLE_STYLE_LINETYPE,
  ROLE_STYLE_LINEWEIGHT,
  ROLE_STYLE_LTSCALE,
  ROLE_STYLE_TRANSPARENCY,
  ROLE_TEXT_FONT_FAMILY,
  ROLE_TEXT_FONT_SIZE,
  ROLE_TEXT_WIDTH_FACTOR,
} from './semantic-roles';

const STYLE = 'style' as const;

/** Απλός scene-channel descriptor για ένα scalar πεδίο του `BaseEntity`. */
function sceneField(params: {
  field: string;
  role: SemanticRole;
  valueType: MatchValueType;
  unit: MatchUnit;
  labelKey: string;
  enumValues?: readonly string[];
  min?: number;
  max?: number;
}): MatchablePropertyDescriptor {
  const { field, role, valueType, unit, labelKey, enumValues, min, max } = params;
  return {
    key: `scene.${field}`,
    role,
    category: STYLE,
    unit,
    valueType,
    channel: 'scene',
    readOnly: false,
    labelKey,
    enumValues,
    min,
    max,
    read: (entity: SceneEntity): MatchableValue | undefined => {
      const v = entity[field];
      return typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean'
        ? v
        : undefined;
    },
    buildFragment: (value: MatchableValue) => ({
      channel: 'scene',
      patch: { [field]: value },
    }),
  };
}

const COLOR_FIELDS = ['color', 'colorMode', 'colorAci', 'colorTrueColor'] as const;

/** Ατομικός color descriptor — μεταφέρει mode+aci+trueColor+hex μαζί. */
const COLOR_DESCRIPTOR: MatchablePropertyDescriptor = {
  key: 'scene.color',
  role: ROLE_STYLE_COLOR,
  category: STYLE,
  unit: 'aci',
  valueType: 'color',
  channel: 'scene',
  readOnly: false,
  labelKey: 'ribbon.contextualTabs.multiSelection.properties.color',
  read: (entity: SceneEntity): ColorValue => ({
    color: typeof entity.color === 'string' ? entity.color : undefined,
    colorMode: entity.colorMode as ColorValue['colorMode'],
    colorAci: typeof entity.colorAci === 'number' ? entity.colorAci : undefined,
    colorTrueColor:
      typeof entity.colorTrueColor === 'number' || entity.colorTrueColor === null
        ? (entity.colorTrueColor as number | null)
        : undefined,
  }),
  buildFragment: (value: MatchableValue) => {
    const patch: Record<string, unknown> = {};
    if (value && typeof value === 'object') {
      const c = value as ColorValue;
      for (const f of COLOR_FIELDS) {
        if (c[f] !== undefined) patch[f] = c[f];
      }
    }
    return { channel: 'scene', patch };
  },
};

/** Καθολικοί style descriptors — για κάθε τύπο οντότητας. */
const UNIVERSAL_STYLE: readonly MatchablePropertyDescriptor[] = [
  COLOR_DESCRIPTOR,
  sceneField({ field: 'linetypeName', role: ROLE_STYLE_LINETYPE, valueType: 'string', unit: 'none', labelKey: 'ribbon.contextualTabs.multiSelection.properties.linetype' }),
  sceneField({ field: 'lineweightMm', role: ROLE_STYLE_LINEWEIGHT, valueType: 'number', unit: 'mm', labelKey: 'ribbon.contextualTabs.multiSelection.properties.lineweight' }),
  sceneField({ field: 'transparency', role: ROLE_STYLE_TRANSPARENCY, valueType: 'number', unit: 'ratio', labelKey: 'ribbon.contextualTabs.multiSelection.properties.transparency', min: 0, max: 1 }),
  sceneField({ field: 'lineStyleId', role: ROLE_STYLE_LINE_STYLE, valueType: 'string', unit: 'none', labelKey: 'ribbon.contextualTabs.multiSelection.properties.lineStyle' }),
  sceneField({ field: 'ltscale', role: ROLE_STYLE_LTSCALE, valueType: 'number', unit: 'ratio', labelKey: 'ribbon.contextualTabs.multiSelection.properties.ltscale', min: 0 }),
  sceneField({ field: 'lineCap', role: ROLE_STYLE_LINE_CAP, valueType: 'enum', unit: 'none', labelKey: 'ribbon.contextualTabs.multiSelection.properties.lineCap', enumValues: ['butt', 'round', 'square'] }),
  sceneField({ field: 'lineJoin', role: ROLE_STYLE_LINE_JOIN, valueType: 'enum', unit: 'none', labelKey: 'ribbon.contextualTabs.multiSelection.properties.lineJoin', enumValues: ['miter', 'round', 'bevel'] }),
];

const TEXT_EXTRAS: readonly MatchablePropertyDescriptor[] = [
  sceneField({ field: 'widthFactor', role: ROLE_TEXT_WIDTH_FACTOR, valueType: 'number', unit: 'ratio', labelKey: 'ribbon.contextualTabs.multiSelection.properties.widthFactor', min: 0.01 }),
  sceneField({ field: 'fontFamily', role: ROLE_TEXT_FONT_FAMILY, valueType: 'string', unit: 'none', labelKey: 'ribbon.contextualTabs.multiSelection.properties.fontFamily' }),
  sceneField({ field: 'fontSize', role: ROLE_TEXT_FONT_SIZE, valueType: 'number', unit: 'mm', labelKey: 'ribbon.contextualTabs.multiSelection.properties.fontSize', min: 0 }),
];

const HATCH_EXTRAS: readonly MatchablePropertyDescriptor[] = [
  sceneField({ field: 'patternName', role: ROLE_HATCH_PATTERN, valueType: 'string', unit: 'none', labelKey: 'ribbon.contextualTabs.multiSelection.properties.hatchPattern' }),
  sceneField({ field: 'patternScale', role: ROLE_HATCH_SCALE, valueType: 'number', unit: 'ratio', labelKey: 'ribbon.contextualTabs.multiSelection.properties.hatchScale', min: 0 }),
  sceneField({ field: 'patternAngle', role: ROLE_HATCH_ANGLE, valueType: 'number', unit: 'deg', labelKey: 'ribbon.contextualTabs.multiSelection.properties.hatchAngle' }),
];

/** Style descriptors για έναν τύπο οντότητας (universal + type-extras). */
export function getStyleMatchables(type: string): readonly MatchablePropertyDescriptor[] {
  if (type === 'text' || type === 'mtext') return [...UNIVERSAL_STYLE, ...TEXT_EXTRAS];
  if (type === 'hatch') return [...UNIVERSAL_STYLE, ...HATCH_EXTRAS];
  return UNIVERSAL_STYLE;
}
