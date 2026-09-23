export function securityHeaders(production = process.env.NODE_ENV === "production"): Record<string, string> {
  const scriptSource = production ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";

  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": `default-src 'self'; script-src ${scriptSource}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none';`,
    ...(production ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
  };
}
