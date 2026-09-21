import { randomUUID } from "node:crypto";
export function requestId(input?: string | null): string { return input && /^[A-Za-z0-9._-]{1,100}$/.test(input) ? input : randomUUID(); }
