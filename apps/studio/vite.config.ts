import vikeRoutegen from "@blankeos/vike-routegen"
import tailwindcss from "@tailwindcss/vite"
import vike from "vike/plugin"
import vikeSolid from "vike-solid/vite"
import { defineConfig } from "vite"
import tsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsConfigPaths(), vike(), vikeSolid(), vikeRoutegen(), tailwindcss()],
  server: { port: 5555 },
  preview: { port: 5555 },
  envPrefix: ["PUBLIC_"],
})
