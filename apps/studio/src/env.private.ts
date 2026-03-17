export const privateEnv = {
  PORT: (process.env.PORT || 5555) as number,
  NODE_ENV: (process.env.NODE_ENV ?? "development") as "development" | "production" | "test",
  SPACETIME_DB: process.env.SPACETIME_DB || "",
  SPACETIME_URI: process.env.SPACETIME_URI || "ws://127.0.0.1:3000",
}
