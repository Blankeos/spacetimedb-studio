import vikeRoutegen from "@blankeos/vike-routegen"
import vike from "vike/plugin"
import vikeSolid from "vike-solid/vite"
import { defineConfig } from "vite"
import tsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsConfigPaths(), vike(), vikeSolid(), vikeRoutegen()],
  server: { port: 5173 },
  preview: { port: 5173 },
  envPrefix: ["PUBLIC_"],
})
