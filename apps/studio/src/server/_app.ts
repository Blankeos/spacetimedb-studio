import { Hono } from "hono"
import { cors } from "hono/cors"
import { spacetimeController } from "./modules/spacetime/spacetime.controller"

const app = new Hono()

app.use(cors())

export const appRouter = app
  .route("/spacetime", spacetimeController)

export type AppRouter = typeof appRouter