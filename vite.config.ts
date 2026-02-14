import { execSync } from "child_process"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { version } from "./package.json"

let commitHash = "unknown"
try {
  commitHash = execSync("git rev-parse --short HEAD").toString().trim()
} catch {
  // Git unavailable or not a git repo — use fallback
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(`${version}+${commitHash}`),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
