// node-postgres connection options, shared by the app and the scripts.

/**
 * DATABASE_URL, plus TLS verified against DATABASE_CA_CERT when that is set: a PEM certificate ("\n" escapes
 * allowed, so it fits on one line) for databases signed by their provider's own CA, such as Supabase. Leave
 * sslmode out of the URL then, since URL parameters override these options.
 */
export function pgConfig(): { connectionString?: string; ssl?: { ca: string } } {
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n").trim();
  return { connectionString: process.env.DATABASE_URL, ...(ca && { ssl: { ca } }) };
}
