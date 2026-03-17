#!/usr/bin/env bun
import process from "node:process"
import chalk from "chalk"
import { spawn } from "child_process"
import { program } from "commander"
import { existsSync } from "fs"
import { join, resolve } from "path"

const DEFAULT_PORT = 5555
const DEFAULT_HOST = "localhost"

// Returns the path to the bundled studio server JS file.
// The bundled server expects client/ to be at ../client relative to itself.
function findStudioServer(): string | null {
  if (process.env.SPACETIME_STUDIO_PATH) {
    if (existsSync(process.env.SPACETIME_STUDIO_PATH)) {
      return process.env.SPACETIME_STUDIO_PATH
    }
  }

  const baseDir = import.meta.dir
  const isCompiled = baseDir === "/$bunfs/root" || baseDir === "/$bunfs"

  const candidates = isCompiled
    ? [
        join(process.cwd(), "dist/studio/server.mjs"),
        join(process.cwd(), "../../apps/studio/dist/server/bundled.mjs"),
      ]
    : [
        // Dev: apps/studio bundled server
        resolve(baseDir, "../../../apps/studio/dist/server/bundled.mjs"),
        // Installed package: bundled server alongside this CLI file
        join(baseDir, "studio/server.mjs"),
        // cwd fallbacks
        join(process.cwd(), "apps/studio/dist/server/bundled.mjs"),
        join(process.cwd(), "dist/studio/server.mjs"),
      ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  return null
}

// Finds the studio directory for --dev mode (needs bun + node_modules)
function findStudioPathForDev(): string | null {
  const baseDir = import.meta.dir
  const devPath = resolve(baseDir, "../../../apps/studio")
  if (existsSync(join(devPath, "dist/server/index.mjs"))) return devPath

  const cwdAppsPath = join(process.cwd(), "apps/studio")
  if (existsSync(join(cwdAppsPath, "dist/server/index.mjs"))) return cwdAppsPath

  return null
}

function debugPaths(): void {
  const baseDir = import.meta.dir
  const isCompiled = baseDir === "/$bunfs/root" || baseDir === "/$bunfs"

  console.log("Debug: Path resolution")
  console.log(chalk.gray(`  import.meta.dir: ${baseDir}`))
  console.log(chalk.gray(`  isCompiled: ${isCompiled}`))
  console.log(chalk.gray(`  cwd: ${process.cwd()}`))

  const studioServer = findStudioServer()
  console.log(chalk.gray(`  studio server: ${studioServer ?? "not found"}`))
}

program
  .name("spacetime-studio")
  .description("A local web-based database studio for SpacetimeDB databases")
  .version("0.0.1")
  .argument("[database]", "Database name to connect to")
  .option("-d, --db <database>", "Database name to connect to")
  .option("-p, --port <port>", "Port to run studio on", String(DEFAULT_PORT))
  .option("-h, --host <host>", "Host to bind to", DEFAULT_HOST)
  .option("--dev", "Run in development mode with hot reload")
  .option("--debug", "Show debug information about paths")
  .action(
    async (
      database: string | undefined,
      options: { db?: string; port: string; host: string; dev?: boolean; debug?: boolean }
    ) => {
      const dbName = database || options.db

      if (options.debug) {
        debugPaths()
        process.exit(0)
      }

      if (!dbName) {
        console.error(chalk.red("Error: Database name is required"))
        console.log(chalk.gray("Usage: spacetime-studio <database>"))
        console.log(chalk.gray("       spacetime-studio --db <database>"))
        process.exit(1)
      }

      const port = parseInt(options.port, 10)
      const host = options.host
      const devMode = options.dev

      console.log(chalk.cyan(`\n  SpacetimeDB Studio\n`))
      console.log(chalk.gray(`  Database: ${chalk.white(dbName)}`))
      console.log(chalk.gray(`  Host: ${host}`))
      console.log(chalk.gray(`  Port: ${port}`))

      // Validate database exists
      console.log(chalk.dim("\n  Validating database..."))
      const validation = await validateDatabase(dbName)

      if (!validation.valid) {
        console.error(chalk.red(`\n  Error: ${validation.error}`))
        console.log(chalk.gray("\n  Make sure:"))
        console.log(chalk.gray("    1. SpacetimeDB is running: spacetime start"))
        console.log(chalk.cyan(`    2. Database exists: spacetime publish ${dbName}`))
        process.exit(1)
      }

      console.log(chalk.green(`  ✓ Database "${dbName}" found`))

      if (validation.tables !== undefined) {
        console.log(
          chalk.dim(`    ${validation.tables} table(s), ${validation.reducers} reducer(s)`)
        )
      }

      const studioUrl = `http://${host}:${port}`
      console.log(chalk.green(`\n  Studio running at: ${chalk.bold(studioUrl)}`))
      if (devMode) {
        console.log(chalk.dim(`  Mode: development (hot reload enabled)`))
      }
      console.log(chalk.gray(`  Press Ctrl+C to stop\n`))

      const serverEnv = {
        ...process.env,
        SPACETIME_DB: dbName,
        PORT: String(port),
        HOST: host,
        NODE_ENV: "production",
      }

      if (devMode) {
        const studioPath = findStudioPathForDev()
        if (!studioPath) {
          console.error(chalk.red("\n  Error: Studio source not found for dev mode."))
          console.log(chalk.gray("  Run from the monorepo root with apps/studio built."))
          process.exit(1)
        }

        const serverProcess = spawn("bun", ["run", "dev"], {
          cwd: studioPath,
          env: { ...serverEnv, NODE_ENV: "development" },
          stdio: "inherit",
          shell: true,
        })

        serverProcess.on("error", (err: Error) => {
          console.error(chalk.red(`Server error: ${err.message}`))
          process.exit(1)
        })

        process.on("SIGINT", () => {
          console.log(chalk.yellow("\n  Shutting down..."))
          serverProcess.kill()
          process.exit(0)
        })
      } else {
        const studioServer = findStudioServer()

        if (!studioServer) {
          console.error(chalk.red("\n  Error: studio-server not found."))
          console.log(chalk.gray("\n  Build the studio first:"))
          console.log(chalk.cyan("    bun run build"))
          process.exit(1)
        }

        const serverProcess = spawn("bun", ["run", studioServer], {
          env: serverEnv,
          stdio: "inherit",
        })

        serverProcess.on("error", (err: Error) => {
          console.error(chalk.red(`\n  Server error: ${err.message}`))
          process.exit(1)
        })

        process.on("SIGINT", () => {
          console.log(chalk.yellow("\n  Shutting down..."))
          serverProcess.kill()
          process.exit(0)
        })
      }
    }
  )

async function validateDatabase(dbName: string): Promise<{
  valid: boolean
  error?: string
  tables?: number
  reducers?: number
}> {
  return new Promise((resolve) => {
    const child = spawn("spacetime", ["describe", dbName, "--json"], {
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    child.stderr.on("data", (data) => {
      stderr += data.toString()
    })

    child.on("close", (code) => {
      if (code !== 0) {
        const errorMsg = stderr.trim() || `Database "${dbName}" not found`
        resolve({
          valid: false,
          error:
            errorMsg.includes("not find") ||
            errorMsg.includes("failed to find") ||
            errorMsg.includes("Connection refused")
              ? `"${dbName}" - Check if SpacetimeDB is running (spacetime start) and database exists (spacetime publish ${dbName})`
              : errorMsg,
        })
        return
      }

      try {
        const schema = JSON.parse(stdout) as {
          tables?: unknown[]
          reducers?: unknown[]
        }
        resolve({
          valid: true,
          tables: schema.tables?.length ?? 0,
          reducers: schema.reducers?.length ?? 0,
        })
      } catch {
        resolve({ valid: true })
      }
    })

    child.on("error", (err) => {
      resolve({
        valid: false,
        error: `Failed to run spacetime CLI: ${err.message}. Is SpacetimeDB installed?`,
      })
    })
  })
}

program.parse()
