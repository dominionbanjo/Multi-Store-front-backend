import sql from "../../connect.js";
import {
  BadRequestError,
  NotFoundError,
} from "../../../utils/errors/customError.js";
import { QueryBuilder } from "./QueryBuilder.js";
import { Cache } from "../../../utils/helpers/Cache.js";

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

export type SchemaDefinition<T extends Record<string, any>> = {
  [K in keyof T]: SchemaField;
};

export abstract class BaseModel<T extends Record<string, any>> {
  protected abstract table: string;
  protected abstract schema: SchemaDefinition<T>;

  // ------------------------------------------------------
  // Utility: build automatic cache key
  // ------------------------------------------------------
  private autoKey(prefix: string, data?: any) {
    const hash = data ? Cache.hash(data) : "";
    return `cache:${this.table}:${prefix}${hash ? ":" + hash : ""}`;
  }

  private listPrefix() {
    return `cache:${this.table}:list`;
  }

  // ------------------------------------------------------
  // CREATE
  // ------------------------------------------------------
  async create(data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const [row] = await sql.unsafe<T[]>(
      `INSERT INTO ${this.table} (${keys.join(", ")})
       VALUES (${placeholders})
       RETURNING *;`,
      values
    );

    // Invalidate list caches
    await Cache.clearPrefix(this.listPrefix());

    return row;
  }

  // ------------------------------------------------------
  // FIND BY ID — cached
  // ------------------------------------------------------
  async findById(
    id: string,
    opts?: { cacheKey?: string; ttl?: number }
  ): Promise<T> {
    const key = opts?.cacheKey || this.autoKey("id", { id });

    const cached = await Cache.get(key);
    if (cached) return cached;

    const [row] = await sql.unsafe<T[]>(
      `SELECT * FROM ${this.table} WHERE id = $1 LIMIT 1;`,
      [id]
    );

    if (!row) throw new NotFoundError(`${this.table} not found`);

    await Cache.set(key, row, opts?.ttl);

    return row;
  }

  // ------------------------------------------------------
  // FIND ONE — cached
  // ------------------------------------------------------
  async findOne(
    filters: Partial<T>,
    opts?: { cacheKey?: string; ttl?: number }
  ): Promise<T | null> {
    const key = opts?.cacheKey || this.autoKey("one", filters);

    const cached = await Cache.get(key);
    if (cached) return cached;

    const keys = Object.keys(filters);
    if (!keys.length) throw new BadRequestError("At least one filter required");

    const values = Object.values(filters);
    const conditions = keys.map((k, i) => `${k} = $${i + 1}`).join(" AND ");

    const [row] = await sql.unsafe<T[]>(
      `SELECT * FROM ${this.table} WHERE ${conditions} LIMIT 1;`,
      values
    );

    if (row) await Cache.set(key, row, opts?.ttl);

    return row || null;
  }

  // ------------------------------------------------------
  // FIND ALL (pagination) — cached
  // ------------------------------------------------------
  async findAll(
    filters?: Partial<T>,
    options?: {
      page?: number;
      limit?: number;
      orderBy?: string;
      cacheKey?: string;
      ttl?: number;
    }
  ) {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;

    const cacheKey =
      options?.cacheKey || this.autoKey("list", { filters, page, limit });

    const cached = await Cache.get(cacheKey);
    if (cached) return cached;

    const values: any[] = [];
    let where = "";

    if (filters && Object.keys(filters).length > 0) {
      const keys = Object.keys(filters);
      where = "WHERE " + keys.map((k, i) => `${k} = $${i + 1}`).join(" AND ");
      values.push(...Object.values(filters));
    }

    const orderBy = options?.orderBy
      ? `ORDER BY ${options.orderBy}`
      : "ORDER BY created_at DESC";

    const offset = (page - 1) * limit;

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

    const payload = {
      data,
      pagination: {
        page,
        limit,
        total: Number(count.total),
        total_pages: Math.ceil(Number(count.total) / limit),
      },
    };

    await Cache.set(cacheKey, payload, options?.ttl);

    return payload;
  }

  // ------------------------------------------------------
  // UPDATE — invalidate item & list caches
  // ------------------------------------------------------
  async update(
    id: string,
    updates: Partial<T>,
    opts?: { ttl?: number }
  ): Promise<T> {
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

    // Invalidate cache for this row
    await Cache.clearPrefix(`cache:${this.table}:id`);
    // Invalidate list caches
    await Cache.clearPrefix(this.listPrefix());

    return row;
  }

  // ------------------------------------------------------
  // DELETE — invalidate caches
  // ------------------------------------------------------
  async delete(id: string): Promise<void> {
    await sql.unsafe(`DELETE FROM ${this.table} WHERE id = $1`, [id]);

    await Cache.clearPrefix(`cache:${this.table}:id`);
    await Cache.clearPrefix(this.listPrefix());
  }

  // ------------------------------------------------------
  // SEARCH — cached
  // ------------------------------------------------------
  async search(
    query: string,
    columns: (keyof T)[],
    opts?: { cacheKey?: string; ttl?: number }
  ) {
    if (!query) throw new BadRequestError("Search query required");

    const cacheKey =
      opts?.cacheKey || this.autoKey("search", { query, columns });

    const cached = await Cache.get(cacheKey);
    if (cached) return cached;

    const conditions = columns
      .map((col, i) => `LOWER(${String(col)}) LIKE LOWER($${i + 1})`)
      .join(" OR ");

    const values = columns.map(() => `%${query}%`);

    const data = await sql.unsafe<T[]>(
      `SELECT * FROM ${this.table}
       WHERE ${conditions}
       ORDER BY created_at DESC;`,
      values
    );

    await Cache.set(cacheKey, data, opts?.ttl);

    return data;
  }

  // ------------------------------------------------------
  // SELECTED FIELDS — cached
  // ------------------------------------------------------
  async findSelected<K extends keyof T>(
    columns: K[],
    filters?: Partial<T>,
    opts?: {
      page?: number;
      limit?: number;
      cacheKey?: string;
      ttl?: number;
    }
  ) {
    if (!columns.length) throw new BadRequestError("No columns selected");

    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 20;

    const cacheKey =
      opts?.cacheKey ||
      this.autoKey("selected", { columns, filters, page, limit });

    const cached = await Cache.get(cacheKey);
    if (cached) return cached;

    const values: any[] = [];
    let where = "";

    if (filters && Object.keys(filters).length > 0) {
      const keys = Object.keys(filters);
      where = "WHERE " + keys.map((k, i) => `${k} = $${i + 1}`).join(" AND ");
      values.push(...Object.values(filters));
    }

    const selectClause = columns.map((c) => `"${String(c)}"`).join(", ");
    const offset = (page - 1) * limit;

    const data = await sql.unsafe<Pick<T, K>[]>(
      `SELECT ${selectClause}
       FROM ${this.table}
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset};`,
      values
    );

    const [count] = await sql.unsafe<{ total: string }[]>(
      `SELECT COUNT(*) AS total FROM ${this.table} ${where};`,
      values
    );

    const payload = {
      data,
      pagination: {
        page,
        limit,
        total: Number(count.total),
        total_pages: Math.ceil(Number(count.total) / limit),
      },
    };

    await Cache.set(cacheKey, payload, opts?.ttl);

    return payload;
  }

  // ------------------------------------------------------
  // QUERY BUILDER
  // ------------------------------------------------------
  query() {
    return new QueryBuilder<T>(this.table);
  }
}
