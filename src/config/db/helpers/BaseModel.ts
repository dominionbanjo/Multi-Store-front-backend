import sql from "../../connect.js";
import {
  BadRequestError,
  NotFoundError,
} from "../../../utils/errors/customError.js";
import { QueryBuilder } from "./QueryBuilder.js";

/**
 * Defines the properties allowed in a schema field
 */
export type SchemaField = {
  type: string;
  primaryKey?: boolean;
  unique?: boolean;
  notNull?: boolean;
  notNullMessage?: string; // ✅ Custom error message for required
  default?: string;
  index?: boolean;
  references?: string;
  onDelete?: string;
  onUpdate?: string;
  min?: number; // ✅ Minimum value
  max?: number; // ✅ Maximum value
};

/**
 * Type-safe schema definition
 */
export type SchemaDefinition<T extends Record<string, any>> = {
  [K in keyof T]: SchemaField;
};

/**
 * 🧩 Generic BaseModel for PostgreSQL
 * - Auto syncs schema
 * - Handles CRUD, pagination, search
 * - Supports FK creation after table setup
 * - Integrates with QueryBuilder
 * - ✅ Adds validation (min, max, notNullMessage)
 */
export abstract class BaseModel<T extends Record<string, any>> {
  protected abstract table: string;
  protected abstract schema: SchemaDefinition<T>;

  // ───────────────────────────────────────────────
  // 🧱 AUTO SYNC (Two-phase)
  // ───────────────────────────────────────────────
  async sync(): Promise<void> {
    // 1️⃣ Create table WITHOUT foreign keys
    const cols = Object.entries(this.schema)
      .map(([name, def]) => {
        let line = `${name} ${def.type}`;
        if (def.primaryKey) line += " PRIMARY KEY";
        if (def.unique) line += " UNIQUE";
        if (def.notNull) line += " NOT NULL";
        if (def.default) line += ` DEFAULT ${def.default}`;
        return line;
      })
      .join(",\n  ");

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.table} (
        ${cols}
      );
    `;
    await sql.unsafe(createTableQuery);

    // 2️⃣ Add foreign keys AFTER all tables exist
    for (const [name, def] of Object.entries(this.schema)) {
      if (def.references) {
        const fkName = `fk_${this.table}_${name}`;
        const constraintQuery = `
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints
              WHERE constraint_name = '${fkName}'
            ) THEN
              ALTER TABLE ${this.table}
              ADD CONSTRAINT ${fkName}
              FOREIGN KEY (${name})
              REFERENCES ${def.references}
              ${def.onDelete ? `ON DELETE ${def.onDelete}` : ""}
              ${def.onUpdate ? `ON UPDATE ${def.onUpdate}` : ""};
            END IF;
          END
          $$;
        `;
        try {
          await sql.unsafe(constraintQuery);
        } catch (err) {
          console.warn(
            `⚠️ Skipped adding FK for ${this.table}.${name} → ${def.references}`,
            (err as Error).message
          );
        }
      }
    }

    // 3️⃣ Create indexes
    for (const [name, def] of Object.entries(this.schema)) {
      if (def.index) {
        const indexName = `idx_${this.table}_${name}`;
        await sql.unsafe(
          `CREATE INDEX IF NOT EXISTS ${indexName} ON ${this.table} (${name});`
        );
      }
    }

    console.log(`✅ Synced table: ${this.table}`);
  }

  // ───────────────────────────────────────────────
  // 🧠 VALIDATION (runs before create/update)
  // ───────────────────────────────────────────────
  private validateData(data: Partial<T>) {
    for (const [key, value] of Object.entries(data)) {
      const def = this.schema[key as keyof T];
      if (!def) continue;

      // Required check
      if (def.notNull && (value === undefined || value === null)) {
        throw new BadRequestError(def.notNullMessage || `${key} is required`);
      }

      // Min/Max numeric validation
      if (typeof value === "number") {
        if (def.min !== undefined && value < def.min) {
          throw new BadRequestError(`${key} must be >= ${def.min}`);
        }
        if (def.max !== undefined && value > def.max) {
          throw new BadRequestError(`${key} must be <= ${def.max}`);
        }
      }
    }
  }

  // ───────────────────────────────────────────────
  // ✅ CREATE
  // ───────────────────────────────────────────────
  async create(data: Partial<T>): Promise<T> {
    if (!data || Object.keys(data).length === 0)
      throw new BadRequestError("No data provided");

    this.validateData(data); // ✅ Validation before insert

    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

    const query = `
      INSERT INTO ${this.table} (${keys.join(", ")})
      VALUES (${placeholders})
      RETURNING *;
    `;

    const [row] = await sql.unsafe<T[]>(query, values);
    return row;
  }

  // ───────────────────────────────────────────────
  // ✅ FIND ONE
  // ───────────────────────────────────────────────
  async findOne(filters: Partial<T>): Promise<T | null> {
    const keys = Object.keys(filters);
    if (keys.length === 0)
      throw new BadRequestError("At least one filter is required");

    const conditions = keys.map((k, i) => `${k} = $${i + 1}`).join(" AND ");
    const values = Object.values(filters);

    const [row] = await sql.unsafe<T[]>(
      `SELECT * FROM ${this.table} WHERE ${conditions} LIMIT 1;`,
      values
    );
    return row || null;
  }

  // ───────────────────────────────────────────────
  // ✅ FIND BY ID
  // ───────────────────────────────────────────────
  async findById(id: string): Promise<T> {
    const [row] = await sql.unsafe<T[]>(
      `SELECT * FROM ${this.table} WHERE id = $1 LIMIT 1;`,
      [id]
    );
    if (!row) throw new NotFoundError(`${this.table} record not found`);
    return row;
  }

  // ───────────────────────────────────────────────
  // ✅ UPDATE
  // ───────────────────────────────────────────────
  async update(id: string, updates: Partial<T>): Promise<T> {
    if (!updates || Object.keys(updates).length === 0)
      throw new BadRequestError("No update data provided");

    this.validateData(updates); // ✅ Validation before update

    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");

    const query = `
      UPDATE ${this.table}
      SET ${setClause}
      WHERE id = $${keys.length + 1}
      RETURNING *;
    `;
    const [row] = await sql.unsafe<T[]>(query, [...values, id]);
    if (!row) throw new NotFoundError(`${this.table} record not found`);
    return row;
  }

  // ───────────────────────────────────────────────
  // ✅ DELETE BY ID
  // ───────────────────────────────────────────────
  async delete(id: string): Promise<void> {
    await sql.unsafe(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
  }

  // ───────────────────────────────────────────────
  // ✅ DELETE WHERE
  // ───────────────────────────────────────────────
  async deleteWhere(filters: Partial<T>): Promise<{ count: number }> {
    if (!filters || Object.keys(filters).length === 0)
      throw new BadRequestError("Filters are required for deleteWhere");

    const keys = Object.keys(filters);
    const values = Object.values(filters);
    const conditions = keys.map((k, i) => `${k} = $${i + 1}`).join(" AND ");

    const query = `
      DELETE FROM ${this.table}
      WHERE ${conditions}
      RETURNING *;
    `;
    const deletedRows = await sql.unsafe<T[]>(query, values);
    return { count: deletedRows.length };
  }

  // ───────────────────────────────────────────────
  // ✅ FIND ALL + PAGINATION
  // ───────────────────────────────────────────────
  async findAll(
    filters?: Partial<T>,
    options?: { page?: number; limit?: number }
  ): Promise<{
    data: T[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const offset = (page - 1) * limit;

    const values: any[] = [];
    let whereClause = "";
    if (filters && Object.keys(filters).length > 0) {
      const keys = Object.keys(filters);
      whereClause =
        "WHERE " + keys.map((k, i) => `${k} = $${i + 1}`).join(" AND ");
      values.push(...Object.values(filters));
    }

    const data = await sql.unsafe<T[]>(
      `SELECT * FROM ${this.table} ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset};`,
      values
    );

    const [countResult] = await sql.unsafe<{ total: string }[]>(
      `SELECT COUNT(*) AS total FROM ${this.table} ${whereClause};`,
      values
    );
    const total = parseInt(countResult.total, 10);

    return { data, pagination: { page, limit, total } };
  }

  // ───────────────────────────────────────────────
  // 🔍 SEARCH
  // ───────────────────────────────────────────────
  async search(
    q: string,
    columns: (keyof T)[],
    options?: { page?: number; limit?: number }
  ): Promise<{
    data: T[];
    pagination: { page: number; limit: number; total: number };
  }> {
    if (!q || q.trim() === "")
      throw new BadRequestError("Search query is required");

    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const offset = (page - 1) * limit;

    const searchConditions = columns
      .map((col, i) => `LOWER(${String(col)}) LIKE LOWER($${i + 1})`)
      .join(" OR ");
    const values = columns.map(() => `%${q}%`);

    const data = await sql.unsafe<T[]>(
      `SELECT * FROM ${this.table} WHERE ${searchConditions} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset};`,
      values
    );
    const [countResult] = await sql.unsafe<{ total: string }[]>(
      `SELECT COUNT(*) AS total FROM ${this.table} WHERE ${searchConditions};`,
      values
    );
    const total = parseInt(countResult.total, 10);

    return { data, pagination: { page, limit, total } };
  }

  // ───────────────────────────────────────────────
  // 🧠 QUERY BUILDER ENTRY
  // ───────────────────────────────────────────────
  query() {
    return new QueryBuilder<T>(this.table);
  }
}
