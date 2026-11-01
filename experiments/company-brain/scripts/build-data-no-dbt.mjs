// Builds the same warehouse as `pnpm data:build` without dbt, which Windows
// Application Control blocks on this machine. Uses the template's model SQL,
// and keeps the catalog.ts that the template ships already generated.
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";

const root = resolve(import.meta.dirname, "..");
const path = resolve(root, "data/jaffle_shop.duckdb");
await mkdir(resolve(root, "data"), { recursive: true });
await rm(path, { force: true });

const instance = await DuckDBInstance.create(path);
const db = await instance.connect();

const compile = async (file) =>
  (await readFile(resolve(root, "dbt/models", file), "utf8")).replace(
    /\{\{\s*ref\('(\w+)'\)\s*\}\}/g,
    "main.$1",
  );

for (const seed of ["raw_customers", "raw_orders", "raw_payments"]) {
  const csv = resolve(root, "dbt/seeds", `${seed}.csv`).replaceAll("\\", "/");
  await db.run(`CREATE TABLE main.${seed} AS SELECT * FROM read_csv_auto('${csv}')`);
}
for (const [name, file] of [
  ["stg_customers", "staging/stg_customers.sql"],
  ["stg_orders", "staging/stg_orders.sql"],
  ["stg_payments", "staging/stg_payments.sql"],
  ["orders", "orders.sql"],
  ["customers", "customers.sql"],
]) {
  await db.run(`CREATE TABLE main.${name} AS ${await compile(file)}`);
}

const check = await db.runAndReadAll(`
  SELECT (SELECT count(*) FROM customers) AS customers,
         (SELECT count(*) FROM orders) AS orders,
         (SELECT round(sum(amount), 2) FROM orders) AS payments_aud,
         (SELECT min(order_date) FROM orders) AS first_order,
         (SELECT max(order_date) FROM orders) AS last_order`);
console.log(check.getRowObjectsJson()[0]);
db.closeSync();
instance.closeSync();
