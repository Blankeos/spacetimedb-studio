export const privateEnv = {
  /** Development | Production */
  PORT: (process.env.PORT || 5173) as number,
  /** Development | Production */
  NODE_ENV: (process.env.NODE_ENV ?? "development") as "development" | "production" | "test",
}
