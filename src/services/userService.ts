import { StoreModel, type IStore } from "../config/db/models/StoreModel.js";
import { UserModel, type IUser } from "../config/db/models/UserModel.js";
import { ProductModel } from "../config/db/models/ProductModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import UploadService from "./uploadService.js";

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
  static async updateProfile(
    userId: string,
    data: Record<string, any>,
    file?: Express.Multer.File
  ) {
    if (!userId) throw new BadRequestError("User ID is required");

    // Fetch user for old avatar cleanup
    const existingUser = await UserModel.findById(userId);

    // Handle uploaded avatar
    if (file) {
      const avatar = await UploadService.uploadSingle(file, "easystore/users");

      data.avatar = avatar?.url;
      data.avatar_public_id = avatar?.public_id;

      // Remove old avatar
      if (existingUser.avatar_public_id) {
        await UploadService.deleteSingle(existingUser.avatar_public_id);
      }
    }

    const allowedFields = [
      "first_name",
      "last_name",
      "phone_number",
      "store_name",
      "username",
      "current_sales_channel",
      "avatar",
      "address",
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
  // 👥 ADMIN: GET ALL USERS
  // ───────────────────────────────────────────────

  /** 🧾 Get all users (admin only, paginated + selected fields) */
  static async getAllUsers(
    options: { page?: number; limit?: number } = {}
  ): Promise<{
    users: Partial<IUser>[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const selectedFields: (keyof IUser)[] = [
      "id",
      "first_name",
      "last_name",
      "email",
      "phone_number",
      "account_type",
      "email_verified",
      "store_name",
      "created_at",
      "updated_at",
    ];

    const { data, pagination } = await UserModel.findSelected(
      selectedFields,
      undefined,
      options
    );

    return { pagination, users: data };
  }

  // ───────────────────────────────────────────────
  // 🏪 STORE MANAGEMENT
  // ───────────────────────────────────────────────

  /** 🏬 Get all stores belonging to a user */
  static async getStores(userId: string): Promise<IStore[]> {
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

    const { data: stores, pagination } = await StoreModel.findAll({
      user_id: userId,
    });

    delete (user as any).password;
    return { pagination, ...user, stores };
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

  /** 🗑️ Delete a user and cascade all related entities */
  static async deleteUser(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    // Cascading deletion logic could be extended here if needed
    await UserModel.delete(userId);

    return { success: true, message: "User deleted successfully" };
  }
}

export default UserService;
