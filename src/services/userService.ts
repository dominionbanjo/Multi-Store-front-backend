import { StoreModel } from "../config/db/models/StoreModel.js";
import { UserModel } from "../config/db/models/UserModel.js";
import { ProductModel } from "../config/db/models/ProductModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";

/**
 * 👤 UserService
 * -------------------------------------------------
 * Handles:
 * - User profile management
 * - Linked stores retrieval and updates
 * - Vendor rating aggregation based on product performance
 * - Admin-level user management
 * -------------------------------------------------
 */
class UserService {
  // ───────────────────────────────────────────────
  // 📄 USER PROFILE
  // ───────────────────────────────────────────────

  /** 🧩 Get a user profile by ID */
  static async getProfile(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    delete (user as any).password;
    return user;
  }

  /** ✏️ Update user profile (with whitelisted fields only) */
  static async updateProfile(userId: string, data: Record<string, any>) {
    if (!userId) throw new BadRequestError("User ID is required");

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

    const updated = await UserModel.update(userId, {
      ...filtered,
      updated_at: new Date().toISOString(),
    });

    delete (updated as any).password;
    return updated;
  }

  // ───────────────────────────────────────────────
  // 🏪 STORE MANAGEMENT
  // ───────────────────────────────────────────────

  /** 🏬 Get all stores belonging to a user */
  static async getStores(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const { data } = await StoreModel.findAll({ user_id: userId });
    return data.sort(
      (a, b) =>
        new Date(b.created_at ?? "").getTime() -
        new Date(a.created_at ?? "").getTime()
    );
  }

  /** 🧭 Get a user and all their linked stores */
  static async getUserWithStore(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const { data: stores } = await StoreModel.findAll({ user_id: userId });

    delete (user as any).password;
    return { ...user, stores };
  }

  /** 🏪 Update a store (owned by the user) */
  static async updateStore(storeId: string, data: Record<string, any>) {
    if (!storeId) throw new BadRequestError("Store ID is required");

    const allowedFields = [
      "store_name",
      "username",
      "description",
      "logo",
      "cover_image",
      "category_ids",
    ];

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

  // ───────────────────────────────────────────────
  // ⭐ VENDOR RATING CALCULATION
  // ───────────────────────────────────────────────

  /**
   * 🧮 Recalculate a vendor’s (user’s) rating based on all their products
   * This should be called after product ratings are updated.
   */
  static async updateVendorRatings(vendorId: string) {
    if (!vendorId) throw new BadRequestError("Vendor ID is required");

    // Fetch all products owned by this vendor
    const { data: vendorProducts } = await ProductModel.findAll({
      vendor_id: vendorId,
    });

    // If vendor has no products, reset stats
    if (vendorProducts.length === 0) {
      await UserModel.update(vendorId, {
        rating_average: 0,
        rating_count: 0,
        review_count: 0,
        updated_at: new Date().toISOString(),
      });
      return { rating_average: 0, review_count: 0 };
    }

    // Calculate totals
    const totalReviews = vendorProducts.reduce(
      (sum, p) => sum + (p.review_count ?? 0),
      0
    );

    const weightedSum = vendorProducts.reduce(
      (sum, p) => sum + Number(p.rating_average ?? 0) * (p.review_count ?? 0),
      0
    );

    const vendorAverage =
      totalReviews > 0
        ? parseFloat((weightedSum / totalReviews).toFixed(2))
        : 0;

    // Update the vendor (user) record
    await UserModel.update(vendorId, {
      rating_average: vendorAverage,
      rating_count: vendorProducts.length,
      review_count: totalReviews,
      updated_at: new Date().toISOString(),
    });

    return { rating_average: vendorAverage, review_count: totalReviews };
  }

  // ───────────────────────────────────────────────
  // ⚙️ ADMIN OPERATIONS
  // ───────────────────────────────────────────────

  /** 🧾 Get all users (paginated) */
  static async getAllUsers(page = 1, limit = 20) {
    const { data, pagination } = await UserModel.findAll({}, { page, limit });
    return { users: data, pagination };
  }

  /** 🗑️ Delete a user and cascade all related entities */
  static async deleteUser(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    await UserModel.delete(userId);

    return { success: true, message: "User deleted successfully" };
  }
}

export default UserService;
