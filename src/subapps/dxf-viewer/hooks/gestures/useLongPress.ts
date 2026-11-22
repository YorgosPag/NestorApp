/**
 * ADR-176: Long Press Detection Hook — **shim**. The hook was promoted to the shared `@/hooks/gestures/useLongPress`
 * (ADR-920 §14.10: the listing terrain inspector needs it outside the viewer). The viewer keeps its own timing SSoT
 * (`DXF_TIMING.gesture.LONG_PRESS`, ADR-516) as the default threshold, so its behaviour is unchanged.
 *
 * @since 2026-02-12
 */

import {
  useLongPress as useSharedLongPress,
  type UseLongPressOptions,
  type UseLongPressReturn,
} from '@/hooks/gestures/useLongPress';
import { DXF_TIMING } from '../../config/dxf-timing';

export function useLongPress(options: UseLongPressOptions): UseLongPressReturn {
  return useSharedLongPress({ threshold: DXF_TIMING.gesture.LONG_PRESS, ...options });
}
