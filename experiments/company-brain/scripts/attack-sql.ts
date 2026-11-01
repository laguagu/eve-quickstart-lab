// Runs hostile and borderline SQL through the template's real guard, with no model.
// expect: "block" must be refused, "allow" must run.
import { querySql } from "../agent/lib/query.ts";

const cases: [string, "block" | "allow", string][] = [
  ["write", "block", "DROP TABLE orders"],
  ["second statement", "block", "SELECT 1; DROP TABLE orders"],
  ["update", "block", "UPDATE orders SET amount = 0"],
  ["export to file", "block", "COPY orders TO 'leak.csv'"],
  ["attach database", "block", "ATTACH 'other.duckdb' AS other"],
  ["set option", "block", "SET enable_external_access = true"],
  ["staging table", "block", "SELECT * FROM stg_payments"],
  ["raw table", "block", "SELECT * FROM raw_customers"],
  ["raw, other case", "block", 'SELECT * FROM "RAW_CUSTOMERS"'],
  ["raw via catalog", "block", "SELECT * FROM jaffle_shop.main.raw_customers"],
  ["raw in CTE", "block", "WITH x AS (SELECT * FROM raw_customers) SELECT * FROM x"],
  ["raw in subquery", "block", "SELECT * FROM orders WHERE customer_id IN (SELECT id FROM raw_customers)"],
  ["raw in UNION", "block", "SELECT first_name FROM customers UNION ALL SELECT first_name FROM raw_customers"],
  ["read local file", "block", "SELECT * FROM read_text('C:/Windows/win.ini')"],
  ["scan by path", "block", "SELECT * FROM 'dbt/seeds/raw_customers.csv'"],
  ["url", "block", "SELECT * FROM read_csv('https://example.com/x.csv')"],
  ["system view", "block", "SELECT * FROM information_schema.tables"],
  ["system function", "block", "SELECT * FROM duckdb_tables()"],
  ["pragma", "block", "PRAGMA database_list"],
  ["show tables", "block", "SHOW TABLES"],
  ["describe", "block", "DESCRIBE raw_customers"],
  ["setting function", "block", "SELECT current_setting('access_mode')"],
  ["env read", "block", "SELECT getenv('PATH')"],
  ["recursive", "block", "WITH RECURSIVE r AS (SELECT 1 n UNION ALL SELECT n + 1 FROM r) SELECT * FROM r"],
  ["pivot", "block", "PIVOT orders ON status USING count(*)"],
  ["wrapper escape", "block", "SELECT 1) AS a; DROP TABLE orders; SELECT * FROM (SELECT 1"],
  ["plain aggregate", "allow", "SELECT status, count(*) AS n, round(sum(amount), 2) AS aud FROM orders GROUP BY status"],
  ["CTE and join", "allow", "WITH t AS (SELECT customer_id, sum(amount) a FROM orders GROUP BY 1) SELECT count(*) FROM t JOIN customers USING (customer_id)"],
  ["customer names (PII)", "allow", "SELECT first_name, last_name, customer_lifetime_value FROM customers ORDER BY 3 DESC NULLS LAST LIMIT 5"],
  ["heavy cross join", "allow", "SELECT count(*) FROM orders a, orders b, orders c, orders d, orders e, orders f"],
];

let wrong = 0;
for (const [name, expect, sql] of cases) {
  const started = Date.now();
  let outcome: "block" | "allow" = "allow";
  let detail = "";
  try {
    const result = await querySql(sql);
    detail = `${result.rows.length} rows: ${JSON.stringify(result.rows[0] ?? null).slice(0, 70)}`;
  } catch (error) {
    outcome = "block";
    detail = String((error as Error).message).slice(0, 70);
  }
  if (outcome !== expect) wrong++;
  console.log(
    `${outcome === expect ? "ok   " : "WRONG"} ${outcome.padEnd(5)} ${name.padEnd(22)} ${String(Date.now() - started).padStart(6)} ms  ${detail}`,
  );
}
console.log(`\n${cases.length - wrong}/${cases.length} as expected`);
