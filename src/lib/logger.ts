const sensitive = /cookie|authorization|access.?token|provider.?payload|password|secret/i;
export function redact(value: unknown): unknown { if (Array.isArray(value)) return value.map(redact); if (!value || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sensitive.test(key) ? "[REDACTED]" : redact(entry)])); }
export function logRequest(input: { requestId: string; route: string; status: number; durationMs: number; code?: string }): void { console.info(JSON.stringify(redact(input))); }
