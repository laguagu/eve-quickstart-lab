// The right answers, from the database and without a model.
import { querySql } from "../agent/lib/query.ts";

process.loadEnvFile(".env.local");
for (const [name, sql] of [
  ["total", "SELECT round(sum(amount), 2) AS aud FROM orders"],
  ["by status", "SELECT status, count(*) AS n, round(sum(amount), 2) AS aud FROM orders GROUP BY status ORDER BY status"],
  ["by month", "SELECT strftime(order_date, '%Y-%m') AS month, count(*) AS n, round(sum(amount), 2) AS aud, max(order_date) AS last_day FROM orders GROUP BY 1 ORDER BY 1"],
] as const) {
  const result = await querySql(sql);
  console.log(name, JSON.stringify(result.rows));
}
