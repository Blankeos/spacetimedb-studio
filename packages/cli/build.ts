import { $ } from "bun"
import { writeFileSync, readFileSync } from "node:fs"

const outFile = "./dist/spacetime-studio"

// Bundle (not compile) so it's cross-platform — requires bun at runtime
await $`bun build ./src/cli.ts --outfile ${outFile} --bundle --target bun --minify`

// Ensure shebang is present (bun bundler may or may not preserve it)
const content = readFileSync(outFile, "utf8")
if (!content.startsWith("#!")) {
  writeFileSync(outFile, "#!/usr/bin/env bun\n" + content)
}

await $`chmod +x ${outFile}`

console.log("✓ Built dist/spacetime-studio")
