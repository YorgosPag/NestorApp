import { Pool } from "pg";

// 🏢 PostgreSQL Connection Pool (Enterprise-grade) — V2 Project Customers API
//
// Εξήχθηκε από το route.ts (κανόνας N.7.1: API routes ≤300 γραμμές, το route.ts
// είχε φτάσει τις 450). Το pool ζει σε ξεχωριστό module ώστε να παραμένει singleton
// και προσβάσιμο τόσο από το κύριο GET query όσο και από τα βοηθητικά query
// functions (getCustomerDetails, getProjectAnalytics) στο customers-queries.ts,
// χωρίς να ανοίγει δεύτερο connection pool.
export const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 20, // Maximum pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
