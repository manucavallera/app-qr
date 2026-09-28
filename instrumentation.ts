/**
 * Next.js instrumentation hook — runs once when the server starts (Node.js runtime only).
 *
 * Runs one cleanup pass when a Node.js server starts. Recurrent cleanup is
 * triggered by the protected external cron endpoint instead of a process-local
 * timer, so builds and short-lived deployments can finish cleanly.
 *
 * This implements the "corte nocturno automático" from the commercial proposal:
 * after the configured closing time, QR orders are disabled and sessions are cleaned up.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { closeExpiredSessions } = await import(
    "./src/modules/tables/session-cleanup"
  );

  const run = async () => {
    try {
      await closeExpiredSessions();
    } catch (error) {
      console.error(JSON.stringify({ event: "session-cleanup-error", error: String(error) }));
    }
  };

  // Sweep immediately on startup to catch leftover sessions from a previous run.
  await run();

}
