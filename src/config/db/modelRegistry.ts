import sql from "../connect.js";

/**
 * Field + Model definitions
 */
export interface ModelField {
  type: string;
  primaryKey?: boolean;
  unique?: boolean;
  notNull?: boolean;
  default?: string;
  references?: string;
}

export interface ModelDefinition {
  tableName: string;
  fields: Record<string, ModelField>;
}

const registeredModels: ModelDefinition[] = [];

/**
 * Define a model and register it.
 * Also returns a TypeScript type derived from the schema.
 */
export function defineModel<const T extends Record<string, ModelField>>(model: {
  tableName: string;
  fields: T;
}) {
  registeredModels.push(model);

  // 🧠 Generate the corresponding TypeScript type dynamically
  type ModelType = {
    [K in keyof T]: T[K]["notNull"] extends true
      ? string | number | boolean // required field
      : string | number | boolean | null; // nullable
  } & { id: string };

  return Object.assign(model, { type: {} as ModelType });
}

/**
 * Sync all registered models with the database.
 */
export async function syncModels() {
  for (const model of registeredModels) {
    const { tableName, fields } = model;

    const columns = Object.entries(fields)
      .map(([name, f]) => {
        let def = `${name} ${f.type}`;
        if (f.primaryKey) def += " PRIMARY KEY";
        if (f.unique) def += " UNIQUE";
        if (f.notNull) def += " NOT NULL";
        if (f.default) def += ` DEFAULT ${f.default}`;
        if (f.references) def += ` REFERENCES ${f.references}`;
        return def;
      })
      .join(",\n  ");

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columns}
      );
    `);
  }

  console.log("✅ Database models synced successfully");
}
