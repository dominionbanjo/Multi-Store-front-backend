import sql from "../db/connect.js";
import { NotFoundError, BadRequestError } from "../utils/errors/customError.js";

class User {
  /** 🧠 Get full non-sensitive profile */
  static async getProfile(id: string) {
    if (!id) throw new BadRequestError("User ID is required");

    const result = await sql`
      SELECT 
        id,
        first_name,
        last_name,
        phone_number,
        email,
        account_type,
        store_name,
        username,
        referral_code,
        current_sales_channel,
        email_verified,
        created_at,
        updated_at
      FROM users
      WHERE id = ${id}
    `;

    if (result.length === 0) throw new NotFoundError("User not found");

    const user = result[0];
    delete (user as any).password;
    return user;
  }

  /** 🏬 Get all stores owned by this user */
  static async getStores(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const result = await sql`
      SELECT 
        s.id,
        s.store_name,
        s.username,
        s.created_at,
        s.updated_at
      FROM stores s
      WHERE s.user_id = ${userId}
      ORDER BY s.created_at DESC
    `;

    return result;
  }

  /** 🧾 Get full user + their stores */
  static async getUserWithStore(id: string) {
    if (!id) throw new BadRequestError("User ID is required");

    const result = await sql`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.account_type,
        COALESCE(
          json_agg(
            json_build_object(
              'id', s.id,
              'store_name', s.store_name,
              'username', s.username,
              'created_at', s.created_at
            )
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS stores
      FROM users u
      LEFT JOIN stores s ON s.user_id = u.id
      WHERE u.id = ${id}
      GROUP BY u.id
    `;

    if (result.length === 0) throw new NotFoundError("User not found");
    return result[0];
  }

  /** ✏️ Update profile fields */
  static async updateProfile(id: string, data: Record<string, any>) {
    if (!id) throw new BadRequestError("User ID is required");

    // Allow only specific fields
    const allowedFields = [
      "first_name",
      "last_name",
      "phone_number",
      "store_name",
      "username",
      "current_sales_channel",
    ];
    const filtered: Record<string, any> = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) filtered[key] = data[key];
    }

    if (Object.keys(filtered).length === 0)
      throw new BadRequestError("No valid fields to update");

    await sql`
      UPDATE users
      SET ${sql(filtered)}, updated_at = NOW()
      WHERE id = ${id}
    `;

    const updated = await this.getProfile(id);
    return updated;
  }

  /** 🏪 Update store info (if multi-store exists) */
  static async updateStore(storeId: string, data: Record<string, any>) {
    if (!storeId) throw new BadRequestError("Store ID is required");

    const allowedFields = ["store_name", "username"];
    const filtered: Record<string, any> = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) filtered[key] = data[key];
    }

    if (Object.keys(filtered).length === 0)
      throw new BadRequestError("No valid fields to update");

    await sql`
      UPDATE stores
      SET ${sql(filtered)}, updated_at = NOW()
      WHERE id = ${storeId}
    `;

    const [store] = await sql`
      SELECT * FROM stores WHERE id = ${storeId}
    `;
    if (!store) throw new NotFoundError("Store not found");

    return store;
  }
}

export default User;
