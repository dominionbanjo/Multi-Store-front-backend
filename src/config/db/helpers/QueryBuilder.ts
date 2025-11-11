import sql from "../../connect.js";

type Operator = "=" | ">" | "<" | ">=" | "<=" | "!=" | "LIKE" | "ILIKE";

export class QueryBuilder<T extends Record<string, any>> {
  private table: string;
  private conditions: string[] = [];
  private params: any[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private orderClause = "";

  constructor(table: string) {
    this.table = table;
  }

  // WHERE { price: { gt: 50 }, name: 'Laptop' }
  where(filters: Record<string, any>) {
    let index = this.params.length;

    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === "object" && value !== null) {
        // Operator filters
        const opKey = Object.keys(value)[0];
        const opMap: Record<string, Operator> = {
          eq: "=",
          ne: "!=",
          gt: ">",
          lt: "<",
          gte: ">=",
          lte: "<=",
          like: "ILIKE",
        };
        const op = opMap[opKey] ?? "=";
        index++;
        this.conditions.push(`${key} ${op} $${index}`);
        this.params.push(value[opKey]);
      } else {
        index++;
        this.conditions.push(`${key} = $${index}`);
        this.params.push(value);
      }
    }
    return this;
  }

  orderBy(column: string, direction: "asc" | "desc" = "asc") {
    this.orderClause = `ORDER BY ${column} ${direction.toUpperCase()}`;
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  offset(value: number) {
    this.offsetValue = value;
    return this;
  }

  async execute(): Promise<T[]> {
    let query = `SELECT * FROM ${this.table}`;
    if (this.conditions.length)
      query += " WHERE " + this.conditions.join(" AND ");
    if (this.orderClause) query += " " + this.orderClause;
    if (this.limitValue !== undefined) query += ` LIMIT ${this.limitValue}`;
    if (this.offsetValue !== undefined) query += ` OFFSET ${this.offsetValue}`;
    query += ";";

    const result = await sql.unsafe<T[]>(query, this.params);
    return result;
  }
}
