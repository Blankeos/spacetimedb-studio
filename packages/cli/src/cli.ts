#!/usr/bin/env bun
import process from "node:process"
import chalk from "chalk"
import { spawn } from "child_process"
import { program } from "commander"
import { existsSync } from "fs"
import { join, resolve } from "path"

const DEFAULT_PORT = 5555
const DEFAULT_HOST = "localhost"

function findStudioPath(): string | null {
  // 1. Check environment variable override
  if (process.env.SPACETIME_STUDIO_PATH) {
    if (existsSync(process.env.SPACETIME_STUDIO_PATH)) {
      return process.env.SPACETIME_STUDIO_PATH
    }
  }

  // 2. Use import.meta.dir which works in both dev and compiled mode
  const baseDir = import.meta.dir

  // Check if we're in compiled mode - bun compile puts us in /$bunfs/root
  const isCompiled = baseDir === "/$bunfs/root" || baseDir === "/$bunfs"

  // For bundled (non-compiled) installs: studio is at dist/studio relative to this file
  if (!isCompiled) {
    const bundledStudioPath = join(baseDir, "studio")
    if (existsSync(join(bundledStudioPath, "dist/server/index.mjs"))) {
      return bundledStudioPath
    }
  }

  // For compiled binaries: prioritize paths relative to cwd
  if (isCompiled) {
    // Check packages/cli/dist/studio (for running from packages/cli)
    const cliDistPath = join(process.cwd(), "dist/studio")
    if (existsSync(join(cliDistPath, "dist/server/index.mjs"))) {
      // Check if apps/studio exists (for node_modules)
      const appsStudioPath = join(process.cwd(), "../../apps/studio")
      if (existsSync(join(appsStudioPath, "dist/server/index.mjs"))) {
        return appsStudioPath // Prefer original location for node_modules access
      }
      return cliDistPath
    }

    // Check current working directory for studio folder
    const cwdStudioPath = join(process.cwd(), "studio")
    if (existsSync(join(cwdStudioPath, "dist/server/index.mjs"))) {
      return cwdStudioPath
    }

    // Check apps/studio from cwd (for monorepo root)
    const cwdAppsPath = join(process.cwd(), "apps/studio")
    if (existsSync(join(cwdAppsPath, "dist/server/index.mjs"))) {
      return cwdAppsPath
    }

    return null
  }

  // Development mode: apps/studio relative to packages/cli/src
  const devPath = resolve(baseDir, "../../../apps/studio")
  const devServerPath = join(devPath, "dist/server/index.mjs")
  if (existsSync(devServerPath)) {
    return devPath
  }

  // Fallback: check cwd-based paths
  const cwdStudioPath = join(process.cwd(), "studio")
  if (existsSync(join(cwdStudioPath, "dist/server/index.mjs"))) {
    return cwdStudioPath
  }

  const cwdAppsPath = join(process.cwd(), "apps/studio")
  if (existsSync(join(cwdAppsPath, "dist/server/index.mjs"))) {
    return cwdAppsPath
  }

  return null
}

function debugPaths(): void {
  const baseDir = import.meta.dir
  const isCompiled = baseDir === "/$bunfs/root" || baseDir === "/$bunfs"

  console.log("Debug: Path resolution")
  console.log(chalk.gray(`  import.meta.dir: ${baseDir}`))
  console.log(chalk.gray(`  isCompiled: ${isCompiled}`))
  console.log(chalk.gray(`  cwd: ${process.cwd()}`))

  if (isCompiled) {
    const cliDistPath = join(process.cwd(), "dist/studio")
    const appsStudioPath = join(process.cwd(), "../../apps/studio")

    console.log(chalk.gray(`  cliDistPath: ${cliDistPath}`))
    console.log(
      chalk.gray(
        `  cliDistPath server exists: ${existsSync(join(cliDistPath, "dist/server/index.mjs"))}`
      )
    )
    console.log(chalk.gray(`  appsStudioPath: ${appsStudioPath}`))
    console.log(
      chalk.gray(
        `  appsStudioPath server exists: ${existsSync(join(appsStudioPath, "dist/server/index.mjs"))}`
      )
    )
  } else {
    const devPath = resolve(baseDir, "../../../apps/studio")
    console.log(chalk.gray(`  devPath: ${devPath}`))
    console.log(
      chalk.gray(`  devServerPath exists: ${existsSync(join(devPath, "dist/server/index.mjs"))}`)
    )
  }
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

      // Set environment for the studio app
      process.env.SPACETIME_DB = dbName
      process.env.PORT = String(port)
      process.env.HOST = host

      // Find studio path
      const studioPath = findStudioPath()

      if (!studioPath) {
        console.error(chalk.red("\n  Error: Studio app not found."))
        console.log(chalk.gray("\n  The studio assets are not bundled."))
        console.log(chalk.gray("  For development, run from the project root:"))
        console.log(chalk.cyan("    cd packages/cli && bun run src/cli.ts <database>"))
        console.log(chalk.gray("\n  For production, build first:"))
        console.log(chalk.cyan("    cd packages/cli && bun run build"))
        process.exit(1)
      }

      const studioUrl = `http://${host}:${port}`
      console.log(chalk.green(`\n  Studio running at: ${chalk.bold(studioUrl)}`))
      if (devMode) {
        console.log(chalk.dim(`  Mode: development (hot reload enabled)`))
      }
      console.log(chalk.gray(`  Press Ctrl+C to stop\n`))

      // Run the studio - always use bun to run the server script
      const serverPath = join(studioPath, "dist/server/index.mjs")

      if (!existsSync(serverPath)) {
        console.error(chalk.red("\n  Error: Studio not built."))
        console.log(chalk.gray("  Run: cd apps/studio && bun run build"))
        process.exit(1)
      }

      if (devMode) {
        // Development: spawn vike dev server
        const serverProcess = spawn("bun", ["run", "dev"], {
          cwd: studioPath,
          env: {
            ...process.env,
            SPACETIME_DB: dbName,
            PORT: String(port),
          },
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
        // Production: run the built server from studio path
        // Note: studioPath should point to apps/studio which has node_modules
        const serverProcess = spawn("bun", ["run", serverPath], {
          cwd: studioPath,
          env: {
            ...process.env,
            SPACETIME_DB: dbName,
            PORT: String(port),
            NODE_ENV: "production",
          },
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
