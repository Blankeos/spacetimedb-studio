import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { parse } from "smol-toml"

interface ServerConfig {
  nickname: string
  host: string
  protocol: string
}

interface CliConfig {
  default_server?: string
  web_session_token?: string
  spacetimedb_token?: string
  server_configs?: ServerConfig[]
}

export interface SpacetimeConnectionConfig {
  uri: string
  database: string
  token: string | null
}

let cachedConfig: CliConfig | null = null

async function readCliConfig(): Promise<CliConfig> {
  if (cachedConfig) return cachedConfig

  const configPath = join(homedir(), ".config/spacetime/cli.toml")

  try {
    const content = await readFile(configPath, "utf-8")
    cachedConfig = parse(content) as CliConfig
    return cachedConfig
  } catch {
    return {}
  }
}

export async function getSpacetimeConnectionConfig(
  database: string,
  serverNickname?: string
): Promise<SpacetimeConnectionConfig> {
  const config = await readCliConfig()

  const targetServer = serverNickname || config.default_server || "local"

  const serverConfig = config.server_configs?.find((s) => s.nickname === targetServer)

  let uri = "ws://127.0.0.1:3000"
  if (serverConfig) {
    const protocol = serverConfig.protocol === "https" ? "wss" : "ws"
    uri = `${protocol}://${serverConfig.host}`
  }

  return {
    uri,
    database,
    token: config.spacetimedb_token || null,
  }
}
