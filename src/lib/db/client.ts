import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      [
        "DATABASE_URL is not set.",
        "  Local:  copy .env.example to .env.local and paste your Neon pooled connection string.",
        "  Hosted: add DATABASE_URL to the project's environment variables for Production,",
        "          Preview and Development — the build reads it while prerendering country",
        "          pages, not only at runtime.",
      ].join("\n"),
    );
  }
  if (!url.includes("-pooler")) {
    console.warn(
      "[db] DATABASE_URL does not look like a pooled Neon endpoint. " +
        "Use the connection string whose host contains '-pooler'.",
    );
  }
  return url;
}

/**
 * Drizzle over Neon's HTTP driver: one round trip per query, no connection
 * pool to manage, which is what we want on serverless. Country pages are
 * static + ISR so this is off the critical render path.
 */
export const db = drizzle(neon(connectionString()), { schema });

export { schema };
