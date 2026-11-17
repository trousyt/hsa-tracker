import { describe, expect, it } from "vitest"
import { parseAuthRedirectOrigins } from "./authRedirectOrigins"

describe("parseAuthRedirectOrigins", () => {
  it("accepts explicitly configured bare HTTPS and localhost origins", () => {
    expect(parseAuthRedirectOrigins("https://example.com,http://localhost:5173")).toEqual([
      "https://example.com", "http://localhost:5173",
    ])
  })

  it.each([undefined, "", "*", "https://example.com/path", "https://example.com/?x=1", "https://user@example.com", "http://example.com", "https://example.com,"])(
    "rejects missing or unsafe origin configuration %s", (value) => {
      expect(() => parseAuthRedirectOrigins(value)).toThrow()
    },
  )
})
