/**
 * Type declarations for generate-harness.mjs (dependency-free Node script).
 * Keeps the drift test type-safe without converting the script to TS.
 */

export type AdapterKind = "plainCopy" | "cursorMdcAdapter" | "qwenAdapter";

export interface HarnessTarget {
  dest: string;
  kind: AdapterKind;
}

export const GENERATED_HEADER: string;
export const REPO_ROOT: string;
export const CANONICAL: string;
export const TEMPLATES: string;
export const TARGETS: HarnessTarget[];
export const CONTRACTS: string[];
export const ADAPTERS: Record<AdapterKind, (content: string) => string>;

export function stripCanonicalHeader(content: string): string;
export function plainCopy(content: string): string;
export function cursorMdcAdapter(content: string): string;
export function qwenAdapter(content: string): string;
export function transform(canonical: string, kind: AdapterKind): string;
export function readCanonical(): string;
