/** Parse the explicit OAuth redirect-origin allowlist; reject unsafe or missing configuration. */
export function parseAuthRedirectOrigins(value: string | undefined): string[] {
  if (!value) throw new Error("AUTH_ALLOWED_REDIRECT_ORIGINS must be configured")
  return value.split(",").map((entry) => {
    const origin = entry.trim()
    let url: URL
    try {
      url = new URL(origin)
    } catch {
      throw new Error("Invalid OAuth redirect origin")
    }
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
        (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost"))) {
      throw new Error("Invalid OAuth redirect origin")
    }
    return url.origin
  })
}
