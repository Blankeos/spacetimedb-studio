import { Hono } from "hono"
import { z } from "zod"
import { privateEnv } from "@/env.private"
import { ApiError } from "@/server/lib/error"
import { describeDatabase, executeSql } from "./spacetime.service"

const sqlRequestSchema = z.object({
  sql: z.string().min(1),
  database: z.string().min(1),
})

export const spacetimeController = new Hono()
  .get("/config", async (c) => {
    return c.json({
      database: privateEnv.SPACETIME_DB || null,
    })
  })
  .post("/sql", async (c) => {
    const body = await c.req.json()
    const parsed = sqlRequestSchema.safeParse(body)

    if (!parsed.success) {
      throw ApiError.BadRequest("Invalid request: sql and database are required")
    }

    const { sql, database } = parsed.data

    try {
      const result = await executeSql(database, sql)
      return c.json({
        success: true,
        data: result,
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Query execution failed"
      throw ApiError.BadRequest(message, { error: err })
    }
  })
  .get("/describe", async (c) => {
    const db = c.req.query("db")

    if (!db) {
      throw ApiError.BadRequest("Database name is required")
    }

    try {
      const result = await describeDatabase(db)
      return c.json({
        success: true,
        data: result,
        error: null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to describe database"
      throw ApiError.BadRequest(message, { error: err })
    }
  })
