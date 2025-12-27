import { useBorderTokens } from "@/hooks/useBorderTokens";
import { COLOR_BRIDGE } from "@/design-system/color-bridge";

export const overlayBase =
  "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0";

// 🏢 ENTERPRISE: Dynamic content base using centralized border tokens
export const createContentBase = (borderTokens: ReturnType<typeof useBorderTokens>) =>
  `fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 ${borderTokens.quick.card} ${COLOR_BRIDGE.bg.primary} p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]`;

// 🔄 BACKWARD COMPATIBILITY: Static export για legacy code
export const contentBase = `fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border ${COLOR_BRIDGE.bg.primary} p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]`;

export const headerBase = "flex flex-col space-y-2 text-center sm:text-left";
export const footerBase = "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2";
export const titleBase = "text-lg font-semibold";
export const descriptionBase = "text-sm text-muted-foreground";
export const cancelExtra = "mt-2 sm:mt-0";
