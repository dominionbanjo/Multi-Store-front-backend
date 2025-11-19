import { StoreModel, type IStore } from "../config/db/models/StoreModel.js";
import { UserModel, type IUser } from "../config/db/models/UserModel.js";
import { ProductModel } from "../config/db/models/ProductModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import UploadService from "./uploadService.js";
import {
  createTransferRecipient,
  verifyBankAccount,
} from "../utils/payment/paystack.js";
import { ServiceCache } from "../utils/helpers/ServiceCache.js";

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

  /** 🧩 Get a user profile by ID (CACHED) */
  static async getProfile(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const key = ServiceCache.key("user", "profile", userId);
    const cached = await ServiceCache.get<IUser>(key);
    if (cached) {
      // ensure password not leaked if it exists in cache
      if ((cached as any).password) delete (cached as any).password;
      return cached;
    }

    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    delete (user as any).password;
    await ServiceCache.set(key, user);
    return user;
  }

  /** ✏️ Update user profile (with whitelisted fields only) → INVALIDATE CACHE */
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

    // Invalidate user cache namespace
    await ServiceCache.clear("svc:user");
    delete (updated as any).password;
    return updated;
  }

  // ───────────────────────────────────────────────
  // 👥 ADMIN: GET ALL USERS
  // ───────────────────────────────────────────────

  /** 🧾 Get all users (admin only, paginated + selected fields) (CACHED per page/limit) */
  static async getAllUsers(
    options: { page?: number; limit?: number } = {}
  ): Promise<{
    users: Partial<IUser>[];
    pagination: { page: number; limit: number; total: number };
  }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 25;
    const key = ServiceCache.key("user", "all", `${page}-${limit}`);

    const cached = await ServiceCache.get<{
      users: Partial<IUser>[];
      pagination: { page: number; limit: number; total: number };
    }>(key);
    if (cached) return cached;

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

    const result = { pagination, users: data };
    await ServiceCache.set(key, result);
    return result;
  }

  // ───────────────────────────────────────────────
  // 🏪 STORE MANAGEMENT
  // ───────────────────────────────────────────────

  /** 🏬 Get all stores belonging to a user (CACHED) */
  static async getStores(userId: string): Promise<IStore[]> {
    if (!userId) throw new BadRequestError("User ID is required");

    const key = ServiceCache.key("user", "stores", userId);
    const cached = await ServiceCache.get<IStore[]>(key);
    if (cached) return cached;

    const { data } = await StoreModel.findAll({ user_id: userId });
    const sorted = data.sort(
      (a, b) =>
        new Date(b.created_at ?? "").getTime() -
        new Date(a.created_at ?? "").getTime()
    );

    await ServiceCache.set(key, sorted);
    return sorted;
  }

  /** 🧭 Get a user and all their linked stores (CACHED) */
  static async getUserWithStore(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const key = ServiceCache.key("user", "withstore", userId);
    const cached = await ServiceCache.get<any>(key);
    if (cached) return cached;

    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const { data: stores, pagination } = await StoreModel.findAll({
      user_id: userId,
    });

    delete (user as any).password;
    const result = { pagination, ...user, stores };
    await ServiceCache.set(key, result);
    return result;
  }

  // ───────────────────────────────────────────────
  // ⭐ VENDOR RATING CALCULATION
  // ───────────────────────────────────────────────

  /**
   * 🧮 Recalculate a vendor’s (user’s) rating based on all their products
   * This should be called after product ratings are updated.
   * After updating user record we invalidate user cache namespace.
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

      // Invalidate user cache namespace
      await ServiceCache.clear("svc:user");

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

    // Invalidate user cache namespace
    await ServiceCache.clear("svc:user");

    return { rating_average: vendorAverage, review_count: totalReviews };
  }

  // ───────────────────────────────────────────────
  // ⚙️ ADMIN OPERATIONS
  // ───────────────────────────────────────────────

  /** 🗑️ Delete a user and cascade all related entities → INVALIDATE CACHE */
  static async deleteUser(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    // Cascading deletion logic could be extended here if needed
    await UserModel.delete(userId);

    // Invalidate user cache namespace
    await ServiceCache.clear("svc:user");

    return { success: true, message: "User deleted successfully" };
  }

  // ───────────────────────────────────────────────
  // 🏦 USER: REGISTER BANK ACCOUNT
  // ───────────────────────────────────────────────
  static async registerBankAccount(
    userId: string,
    bank_code: string,
    account_number: string,
    settlement_email?: string
  ) {
    if (!userId || !bank_code || !account_number)
      throw new BadRequestError("Missing required bank details");

    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const verified = await verifyBankAccount(account_number, bank_code);
    if (!verified?.account_name)
      throw new BadRequestError("Bank account could not be verified");

    // Create Paystack recipient
    const recipient_code = await createTransferRecipient({
      name: verified.account_name,
      account_number,
      bank_code,
    });

    const updated = await UserModel.update(userId, {
      account_number,
      bank_code,
      bank_name: verified.bank_name || verified.account_name,
      recipient_code,
      payout_verified: true,
      settlement_email: settlement_email || user.settlement_email,
      updated_at: new Date().toISOString(),
    });

    // Invalidate user cache namespace
    await ServiceCache.clear("svc:user");

    return {
      success: true,
      message: "Bank account registered successfully",
      user: updated,
    };
  }

  // ───────────────────────────────────────────────
  // 🏦 USER: UPDATE BANK ACCOUNT
  // ───────────────────────────────────────────────
  static async updateBankAccount(
    userId: string,
    updates: {
      account_number?: string;
      bank_code?: string;
      settlement_email?: string;
    }
  ) {
    if (!userId) throw new BadRequestError("User ID is required");

    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const { account_number, bank_code, settlement_email } = updates;

    if (!account_number && !bank_code && !settlement_email) {
      throw new BadRequestError("No bank details provided for update");
    }

    let verifiedAccount = null;
    let recipient_code = user.recipient_code;
    let bank_name = user.bank_name;

    const bankDetailsChanged =
      (account_number && account_number !== user.account_number) ||
      (bank_code && bank_code !== user.bank_code);

    if (bankDetailsChanged) {
      const acctNum = account_number || user.account_number;
      const bCode = bank_code || user.bank_code;

      if (!acctNum || !bCode) {
        throw new BadRequestError(
          "Both account number and bank code are required for verification"
        );
      }

      verifiedAccount = await verifyBankAccount(acctNum, bCode);

      if (!verifiedAccount?.account_name) {
        throw new BadRequestError("Bank verification failed — invalid details");
      }

      recipient_code = await createTransferRecipient({
        name: verifiedAccount.account_name,
        account_number: acctNum,
        bank_code: bCode,
      });

      bank_name = verifiedAccount.bank_name || verifiedAccount.account_name;
    }

    const updated = await UserModel.update(userId, {
      account_number: account_number || user.account_number,
      bank_code: bank_code || user.bank_code,
      bank_name,
      recipient_code,
      settlement_email: settlement_email || user.settlement_email,
      updated_at: new Date().toISOString(),
    });

    // Invalidate user cache namespace
    await ServiceCache.clear("svc:user");

    return {
      success: true,
      message: verifiedAccount
        ? "Bank verified and updated successfully"
        : "Settlement email updated successfully",
      user: updated,
      verified: verifiedAccount || null,
    };
  }
  // ───────────────────────────────────────────────
  // 🏦 USER: DELETE BANK ACCOUNT
  // ───────────────────────────────────────────────
  static async deleteBankAccount(userId: string) {
    if (!userId) throw new BadRequestError("User ID is required");

    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const cleared = await UserModel.update(userId, {
      account_number: null,
      bank_code: null,
      bank_name: null,
      recipient_code: null,
      payout_verified: false,
      settlement_email: null,
      updated_at: new Date().toISOString(),
    });

    // Invalidate user cache namespace
    await ServiceCache.clear("svc:user");

    return {
      success: true,
      message: "Bank account removed successfully",
      user: cleared,
    };
  }
}

export default UserService;
