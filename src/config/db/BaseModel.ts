import sql from "../../config/connect.js";
import {
  BadRequestError,
  NotFoundError,
} from "../../utils/errors/customError.js";

/**
 * 🧩 Generic BaseModel with helper CRUD operations — safe for postgres driver
 */
export abstract class BaseModel<T extends Record<string, any>> {
  protected abstract table: string;

  /** ✅ Create record */
  async create(data: Partial<T>): Promise<T> {
    if (!data || Object.keys(data).length === 0)
      throw new BadRequestError("No data provided");

    const keys = Object.keys(data);
    const values = Object.values(data);

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const columns = keys.join(", ");

    const query = `
      INSERT INTO ${this.table} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `;

    const [row] = await sql.unsafe<T[]>(query, values);
    return row;
  }

  /** ✅ Find by filters (single record) */
  async findOne(filters: Partial<T>): Promise<T | null> {
    const keys = Object.keys(filters);
    if (keys.length === 0) throw new BadRequestError("No filters provided");

    const conditions = keys.map((k, i) => `${k} = $${i + 1}`).join(" AND ");
    const values = Object.values(filters);
    const query = `SELECT * FROM ${this.table} WHERE ${conditions} LIMIT 1`;

    const [row] = await sql.unsafe<T[]>(query, values);
    return row || null;
  }

  /** ✅ Find by ID */
  async findById(id: string): Promise<T> {
    const query = `SELECT * FROM ${this.table} WHERE id = $1`;
    const [row] = await sql.unsafe<T[]>(query, [id]);
    if (!row) throw new NotFoundError(`${this.table} record not found`);
    return row;
  }

  /** ✅ Update record */
  async update(id: string, updates: Partial<T>): Promise<T> {
    if (!updates || Object.keys(updates).length === 0)
      throw new BadRequestError("No updates provided");

    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");

    const query = `
      UPDATE ${this.table}
      SET ${setClause}
      WHERE id = $${keys.length + 1}
      RETURNING *
    `;

    const [row] = await sql.unsafe<T[]>(query, [...values, id]);
    if (!row) throw new NotFoundError(`${this.table} record not found`);
    return row;
  }

  /** ✅ Delete record */
  async delete(id: string): Promise<void> {
    const query = `DELETE FROM ${this.table} WHERE id = $1`;
    await sql.unsafe(query, [id]);
  }

  /** ✅ Find all with optional filters */
  async findAll(filters?: Partial<T>): Promise<T[]> {
    if (!filters || Object.keys(filters).length === 0) {
      const query = `SELECT * FROM ${this.table}`;
      return await sql.unsafe<T[]>(query);
    }

    const keys = Object.keys(filters);
    const values = Object.values(filters);
    const conditions = keys.map((k, i) => `${k} = $${i + 1}`).join(" AND ");
    const query = `SELECT * FROM ${this.table} WHERE ${conditions}`;

    return await sql.unsafe<T[]>(query, values);
  }
}
