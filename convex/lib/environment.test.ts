import { afterEach, describe, expect, it, vi } from "vitest"
import { getEnvironmentVariable } from "./environment"

afterEach(() => vi.unstubAllEnvs())

describe("getEnvironmentVariable", () => {
  it("preserves configured, empty and missing environment values", () => {
    vi.stubEnv("OWNER_GITHUB_ID", "123")
    expect(getEnvironmentVariable("OWNER_GITHUB_ID")).toBe("123")
    vi.stubEnv("OWNER_GITHUB_ID", "")
    expect(getEnvironmentVariable("OWNER_GITHUB_ID")).toBe("")
    vi.stubEnv("OWNER_GITHUB_ID", undefined)
    expect(getEnvironmentVariable("OWNER_GITHUB_ID")).toBeUndefined()
  })
})
