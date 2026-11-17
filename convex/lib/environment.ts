// Convex's default runtime exposes process.env, not the full Node.js API.
// Keep this declaration module-local: generated API types are also read by the browser project.
declare const process: { env: Readonly<Record<string, string | undefined>> }

/** Read a backend environment variable without adding Node globals to frontend types. */
export function getEnvironmentVariable(name: string): string | undefined {
  return process.env[name]
}
