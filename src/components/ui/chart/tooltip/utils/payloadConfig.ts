'use client';
import { getPayloadConfigFromPayload } from "../../chartHelpers";
import type { Cfg, TooltipPayloadItem } from "../types";

export function resolveItemConfig(cfg: Cfg, item: TooltipPayloadItem, key: string) {
  return getPayloadConfigFromPayload(cfg, item, key);
}
