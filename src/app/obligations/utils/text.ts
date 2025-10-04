
"use client";

export function safeLower(str: string | undefined | null): string {
    return (str || '').toLowerCase();
}

    