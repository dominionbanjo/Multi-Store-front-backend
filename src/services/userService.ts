import { StoreModel } from "../config/db/models/StoreModel.js";
import { UserModel } from "../config/db/models/UserModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";

class UserService {
  /** 🧩 Get profile */
  static async getProfile(id: string) {
    if (!id) throw new BadRequestError("User ID is required");
    const user = await UserModel.findById(id);
    if (!user) throw new NotFoundError("User not found");
    delete (user as any).password;
    return user;
  }

  /** 🏬 Get all stores belonging to user */
  static async getStores(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");
    const stores = await StoreModel.findAll({ user_id: userId });
    // mimic your ORDER BY created_at DESC:
    return stores.sort(
      (a, b) =>
        new Date(b.created_at ?? "").getTime() -
        new Date(a.created_at ?? "").getTime()
    );
  }

  /** 🧭 Get user + stores (join manually in JS) */
  static async getUserWithStore(id: string) {
    if (!id) throw new BadRequestError("User ID is required");

    const user = await UserModel.findById(id);
    if (!user) throw new NotFoundError("User not found");

    const stores = await StoreModel.findAll({ user_id: id });
    return { ...user, stores };
  }

  /** ✏️ Update profile */
  static async updateProfile(id: string, data: Record<string, any>) {
    if (!id) throw new BadRequestError("User ID is required");

    const allowedFields = [
      "first_name",
      "last_name",
      "phone_number",
      "store_name",
      "username",
      "current_sales_channel",
      "avatar",
      "avatar_public_id",
    ];
    const filtered: Record<string, any> = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) filtered[key] = data[key];
    }

    if (Object.keys(filtered).length === 0)
      throw new BadRequestError("No valid fields to update");

    const updated = await UserModel.update(id, {
      ...filtered,
      updated_at: new Date().toISOString(),
    });

    delete (updated as any).password;
    return updated;
  }

  /** 🏪 Update store */
  static async updateStore(storeId: string, data: Record<string, any>) {
    if (!storeId) throw new BadRequestError("Store ID is required");

    const allowedFields = ["store_name", "username"];
    const filtered: Record<string, any> = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) filtered[key] = data[key];
    }

    if (Object.keys(filtered).length === 0)
      throw new BadRequestError("No valid fields to update");

    const updated = await StoreModel.update(storeId, {
      ...filtered,
      updated_at: new Date().toISOString(),
    });

    return updated;
  }
}

export default UserService;
