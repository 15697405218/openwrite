import { readFileSync } from "node:fs"
import { defineConfig, type Plugin } from "vitest/config"

function markdownAsText(): Plugin {
  return {
    name: "markdown-as-text",
    enforce: "pre",
    load(id) {
      const file = id.split("?")[0]
      if (!file?.endsWith(".md")) {
        return null
      }
      return `export default ${JSON.stringify(readFileSync(file, "utf8"))}`
    },
  }
}

export default defineConfig({
  plugins: [markdownAsText()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
