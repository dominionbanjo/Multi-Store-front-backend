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
  notNullMessage?: string;
  default?: string;
  index?: boolean;
  references?: string;
  onDelete?: string;
  onUpdate?: string;
  min?: number;
  max?: number;
};

/**
 * Type-safe schema definition
 */
export type SchemaDefinition<T extends Record<string, any>> = {
  [K in keyof T]: SchemaField;
};

/**
 * 🔥 FINAL BaseModel — with:
 * - GIN index support
 * - advanced validation
 * - dynamic schema sync
 * - improved findSelected()
 * - simple LIKE search()
 * - FK & index auto-generation
 */
export abstract class BaseModel<T extends Record<string, any>> {
  protected abstract table: string;
  protected abstract schema: SchemaDefinition<T>;

  // ───────────────────────────────────────────────
  // AUTO SYNC
  // ───────────────────────────────────────────────
  async sync(): Promise<void> {
    console.log(`🔄 Syncing table: ${this.table}`);

    // 1. CREATE TABLE
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

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        ${cols}
      );
    `);

    // 2. FETCH EXISTING COLUMNS
    const existingCols = await sql.unsafe<{ column_name: string }[]>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = '${this.table}';
    `);

    const existingNames = existingCols.map((c) => c.column_name);

    // 3. ADD missing columns
    for (const [name, def] of Object.entries(this.schema)) {
      if (!existingNames.includes(name)) {
        let line = `${name} ${def.type}`;
        if (def.notNull) line += " NOT NULL";
        if (def.default) line += ` DEFAULT ${def.default}`;

        try {
          await sql.unsafe(`ALTER TABLE ${this.table} ADD COLUMN ${line};`);
          console.log(`🟢 Added missing column: ${name}`);
        } catch (err) {
          console.warn(`⚠️ Failed to add ${name}:`, (err as Error).message);
        }
      }
    }

    // 4. ADD Foreign Keys
    for (const [name, def] of Object.entries(this.schema)) {
      if (!def.references) continue;

      const fkName = `fk_${this.table}_${name}`;

      await sql.unsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE constraint_name = '${fkName}'
          ) THEN
            ALTER TABLE ${this.table}
              ADD CONSTRAINT ${fkName}
              FOREIGN KEY (${name})
              REFERENCES ${def.references}
              ${def.onDelete ? `ON DELETE ${def.onDelete}` : ""}
              ${def.onUpdate ? `ON UPDATE ${def.onUpdate}` : ""};
          END IF;
        END $$;
      `);
    }

    // 5. NORMAL INDEXES
    for (const [name, def] of Object.entries(this.schema)) {
      if (!def.index) continue;

      const indexName = `idx_${this.table}_${name}`;
      await sql.unsafe(`
        CREATE INDEX IF NOT EXISTS ${indexName}
        ON ${this.table} (${name});
      `);
    }

    // ⭐ 6. GIN Index for TSVECTOR fields
    for (const [name, def] of Object.entries(this.schema)) {
      if (def.type !== "TSVECTOR") continue;

      const indexName = `idx_${this.table}_${name}_gin`;

      await sql.unsafe(`
        CREATE INDEX IF NOT EXISTS ${indexName}
        ON ${this.table}
        USING GIN (${name});
      `);

      console.log(`🟢 GIN index created: ${indexName}`);
    }

    console.log(`✅ Synced table: ${this.table}`);
  }

  // ───────────────────────────────────────────────
  // VALIDATION
  // ───────────────────────────────────────────────
  private validateData(data: Partial<T>) {
    for (const [key, value] of Object.entries(data)) {
      const def = this.schema[key as keyof T];
      if (!def) continue;

      // Required
      if (def.notNull && (value === undefined || value === null)) {
        throw new BadRequestError(def.notNullMessage || `${key} is required`);
      }

      // Number range validation
      if (typeof value === "number") {
        if (def.min !== undefined && value < def.min)
          throw new BadRequestError(`${key} must be >= ${def.min}`);
        if (def.max !== undefined && value > def.max)
          throw new BadRequestError(`${key} must be <= ${def.max}`);
      }
    }
  }

  // ───────────────────────────────────────────────
  // CREATE
  // ───────────────────────────────────────────────
  async create(data: Partial<T>): Promise<T> {
    this.validateData(data);

    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

    const [row] = await sql.unsafe<T[]>(
      `INSERT INTO ${this.table} (${keys.join(", ")})
       VALUES (${placeholders})
       RETURNING *;`,
      values
    );

    return row;
  }

  // ───────────────────────────────────────────────
  // FIND ONE
  // ───────────────────────────────────────────────
  async findOne(filters: Partial<T>): Promise<T | null> {
    const keys = Object.keys(filters);
    if (keys.length === 0)
      throw new BadRequestError("At least one filter is required");

    const values = Object.values(filters);
    const conditions = keys.map((k, i) => `${k} = $${i + 1}`).join(" AND ");

    const [row] = await sql.unsafe<T[]>(
      `SELECT * FROM ${this.table} WHERE ${conditions} LIMIT 1;`,
      values
    );

    return row || null;
  }

  // ───────────────────────────────────────────────
  // FIND BY ID
  // ───────────────────────────────────────────────
  async findById(id: string): Promise<T> {
    const [row] = await sql.unsafe<T[]>(
      `SELECT * FROM ${this.table} WHERE id = $1 LIMIT 1;`,
      [id]
    );

    if (!row) throw new NotFoundError(`${this.table} not found`);

    return row;
  }

  // ───────────────────────────────────────────────
  // UPDATE
  // ───────────────────────────────────────────────
  async update(id: string, updates: Partial<T>): Promise<T> {
    this.validateData(updates);

    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");

    const [row] = await sql.unsafe<T[]>(
      `UPDATE ${this.table}
       SET ${setClause}
       WHERE id = $${keys.length + 1}
       RETURNING *;`,
      [...values, id]
    );

    if (!row) throw new NotFoundError(`${this.table} not found`);
    return row;
  }

  // ───────────────────────────────────────────────
  // DELETE
  // ───────────────────────────────────────────────
  async delete(id: string): Promise<void> {
    await sql.unsafe(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
  }

  // ───────────────────────────────────────────────
  // DELETE WHERE (bulk delete with filters)
  // ───────────────────────────────────────────────
  async deleteWhere(filters: Partial<T>): Promise<{ count: number }> {
    if (!filters || Object.keys(filters).length === 0)
      throw new BadRequestError("Filters are required for deleteWhere");

    const keys = Object.keys(filters);
    const values = Object.values(filters);
    const conditions = keys.map((k, i) => `${k} = $${i + 1}`).join(" AND ");

    const deletedRows = await sql.unsafe<T[]>(
      `DELETE FROM ${this.table}
     WHERE ${conditions}
     RETURNING *;`,
      values
    );

    return { count: deletedRows.length };
  }

  // ───────────────────────────────────────────────
  // FIND ALL (paginated)
  // ───────────────────────────────────────────────
  async findAll(
    filters?: Partial<T>,
    options?: { page?: number; limit?: number; orderBy?: string }
  ) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const offset = (page - 1) * limit;

    const values: any[] = [];
    let where = "";

    if (filters && Object.keys(filters).length > 0) {
      const keys = Object.keys(filters);
      where = "WHERE " + keys.map((k, i) => `${k} = $${i + 1}`).join(" AND ");
      values.push(...Object.values(filters));
    }

    // ⭐ Allow dynamic ordering, fallback to created_at DESC
    const orderBy = options?.orderBy
      ? `ORDER BY ${options.orderBy}`
      : `ORDER BY created_at DESC`;

    const data = await sql.unsafe<T[]>(
      `SELECT * FROM ${this.table}
     ${where}
     ${orderBy}
     LIMIT ${limit} OFFSET ${offset};`,
      values
    );

    const [count] = await sql.unsafe<{ total: string }[]>(
      `SELECT COUNT(*) AS total FROM ${this.table} ${where};`,
      values
    );

    const total = Number(count.total);
    const total_pages = Math.ceil(total / limit);

    return { data, pagination: { page, limit, total, total_pages } };
  }

  // ───────────────────────────────────────────────
  // SIMPLE LIKE SEARCH (no pagination)
  // ───────────────────────────────────────────────
  async search(q: string, columns: (keyof T)[]) {
    if (!q || q.trim() === "")
      throw new BadRequestError("Search query is required");

    const conditions = columns
      .map((col, i) => `LOWER(${String(col)}) LIKE LOWER($${i + 1})`)
      .join(" OR ");

    const values = columns.map(() => `%${q}%`);

    const data = await sql.unsafe<T[]>(
      `SELECT * FROM ${this.table}
       WHERE ${conditions}
       ORDER BY created_at DESC;`,
      values
    );

    return { data };
  }

  // ───────────────────────────────────────────────
  // SELECTED FIELDS (projection)
  // ───────────────────────────────────────────────
  async findSelected<K extends keyof T>(
    columns: K[],
    filters?: Partial<T>,
    options?: { page?: number; limit?: number }
  ) {
    if (!columns.length) {
      throw new BadRequestError("Select at least one field");
    }

    // Validate selected columns
    for (const col of columns) {
      if (!(col in this.schema)) {
        throw new BadRequestError(`Invalid column: ${String(col)}`);
      }
    }

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

    const selectClause = columns.map((c) => `"${String(c)}"`).join(", ");

    // ⭐ FIX: stable ordering for pagination
    const data = await sql.unsafe<Pick<T, K>[]>(
      `
      SELECT ${selectClause}
      FROM ${this.table}
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit} OFFSET ${offset};
    `,
      values
    );

    const [count] = await sql.unsafe<{ total: string }[]>(
      `
      SELECT COUNT(*) AS total
      FROM ${this.table}
      ${whereClause};
    `,
      values
    );

    const total = Number(count.total);
    const total_pages = Math.ceil(total / limit);

    return {
      pagination: { page, limit, total, total_pages },
      data,
    };
  }

  // ───────────────────────────────────────────────
  // QUERY BUILDER ENTRY
  // ───────────────────────────────────────────────
  query() {
    return new QueryBuilder<T>(this.table);
  }
}
