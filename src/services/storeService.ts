import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";
import { StoreModel, IStore } from "../config/db/models/StoreModel.js";
import { ProductModel } from "../config/db/models/ProductModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import {
  createTransferRecipient,
  verifyBankAccount,
} from "../utils/payment/paystack.js";

class StoreService {
  // ───────────────────────────────────────────────
  // 🔤 UNIQUE SLUG GENERATOR
  // ───────────────────────────────────────────────
  private static async generateUniqueSlug(store_name: string): Promise<string> {
    const baseSlug = slugify(store_name, { lower: true, strict: true });
    let slug = baseSlug;
    let counter = 1;

    while (await StoreModel.findOne({ slug })) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }

    return slug;
  }

  /** 🏬 Create a new store (vendor only) */
  static async createStore(
    data: Omit<IStore, "id" | "created_at" | "updated_at">
  ) {
    if (!data.user_id || !data.store_name)
      throw new BadRequestError("Missing required store fields");

    const existing = await StoreModel.findOne({ store_name: data.store_name });
    if (existing)
      throw new BadRequestError("Store name already taken, choose another");

    const slug = await this.generateUniqueSlug(data.store_name);

    const store = await StoreModel.create({
      ...data,
      id: uuidv4(),
      slug,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      analytics: { sales: [], orders: [], customers: [] },
    });

    return store;
  }

  // ───────────────────────────────────────────────
  // 🧭 CATEGORY DERIVATION HELPER
  // ───────────────────────────────────────────────

  /** 🏷️ Get unique categories for a store (derived from its products) */
  static async getStoreCategories(storeId: string): Promise<string[]> {
    if (!storeId) throw new BadRequestError("Store ID is required");

    const products = await ProductModel.findSelected(
      ["category"],
      { store_id: storeId },
      { page: 1, limit: 100 }
    );

    const categories = Array.from(
      new Set(products.data.map((p: any) => p.category).filter(Boolean))
    );

    return categories;
  }

  // ───────────────────────────────────────────────
  // 📄 GET SINGLE STORE (BY ID OR USERNAME)
  // ───────────────────────────────────────────────
  static async getStore(
    identifier: string
  ): Promise<IStore & { categories: string[] }> {
    if (!identifier) throw new BadRequestError("Store identifier required");

    // ✅ Detect if identifier is UUID or username
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier
      );

    const store = isUUID
      ? await StoreModel.findOne({ id: identifier })
      : await StoreModel.findOne({ slug: identifier });

    if (!store) throw new NotFoundError("Store not found");

    const categories = await StoreService.getStoreCategories(store.id);

    return { ...store, categories };
  }

  // ───────────────────────────────────────────────
  // 🧾 GET ALL STORES (WITH LIMITED FIELDS + CATEGORIES)
  // ───────────────────────────────────────────────
  static async getAllStores(page = 1, limit = 20) {
    const { data: stores, pagination } = await StoreModel.findSelected(
      [
        "id",
        "store_name",
        "category",
        "description",
        "address",
        "total_products",
        "logo",
        "rating_average",
      ],
      {},
      { page, limit }
    );

    const enrichedStores = await Promise.all(
      stores.map(async (store) => {
        const categories = await StoreService.getStoreCategories(store.id);
        return { ...store, categories };
      })
    );

    return { stores: enrichedStores, pagination };
  }

  // ───────────────────────────────────────────────
  // 🧾 GET ALL STORES (ADMIN — FULL DETAILS)
  // ───────────────────────────────────────────────
  static async getAllStoresAdmin(page = 1, limit = 20) {
    const { data: stores, pagination } = await StoreModel.findAll(
      {},
      { page, limit }
    );

    const enrichedStores = await Promise.all(
      stores.map(async (store) => {
        const categories = await StoreService.getStoreCategories(store.id);
        return { ...store, categories };
      })
    );

    return {
      data: enrichedStores,
      pagination,
    };
  }

  // ───────────────────────────────────────────────
  // 🧭 GET STORE PRODUCTS
  // ───────────────────────────────────────────────

  static async getStoreProducts(identifier: string, page = 1, limit = 20) {
    if (!identifier) throw new BadRequestError("Store identifier is required");

    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier
      );

    // Find store by ID or slug
    const store = isUUID
      ? await StoreModel.findOne({ id: identifier })
      : await StoreModel.findOne({ slug: identifier });

    if (!store) throw new NotFoundError("Store not found");

    // Fetch products for that store
    const { data, pagination } = await ProductModel.findAll(
      { store_id: store.id },
      { page, limit }
    );

    return { products: data, pagination };
  }
  // ───────────────────────────────────────────────
  // ✏️ UPDATE STORE
  // ───────────────────────────────────────────────
  // inside StoreService
  static async updateStore(storeId: string, data: Record<string, any>) {
    if (!storeId) throw new BadRequestError("Store ID is required");

    // ✅ Verify store exists
    const existingStore = await StoreModel.findById(storeId);
    if (!existingStore) throw new NotFoundError("Store not found");

    // ✅ Define allowed update fields
    const allowedFields = [
      "store_name",
      "description",
      "logo",
      "logo_public_id",
      "cover_image",
      "cover_image_public_id",
      "category",
      "category_ids",
      "email",
      "phone_number",
      "website",
      "address",
    ];
    // ✅ Filter only allowed fields
    const filtered: Record<string, any> = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) filtered[key] = data[key];
    }

    // ✅ If no valid fields, throw
    if (Object.keys(filtered).length === 0) {
      throw new BadRequestError("No valid fields to update");
    }

    // ✅ If store_name is being changed, check for duplicates
    if (
      filtered.store_name &&
      filtered.store_name.toLowerCase() !==
        existingStore.store_name.toLowerCase()
    ) {
      const duplicate = await StoreModel.findOne({
        store_name: filtered.store_name,
      });
      if (duplicate && duplicate.id !== storeId) {
        throw new BadRequestError("Store name already in use by another store");
      }

      // ✅ Generate new unique slug if name changes
      filtered.slug = await this.generateUniqueSlug(filtered.store_name);
    }

    // ✅ Apply updates
    const updatedStore = await StoreModel.update(storeId, {
      ...filtered,
      updated_at: new Date().toISOString(),
    });

    return updatedStore;
  }

  // ───────────────────────────────────────────────
  // ❌ DELETE STORE
  // ───────────────────────────────────────────────
  static async deleteStore(storeId: string) {
    if (!storeId) throw new BadRequestError("Store ID is required");

    const existing = await StoreModel.findById(storeId);
    if (!existing) throw new NotFoundError("Store not found");

    await StoreModel.delete(storeId);
    return { success: true, message: "Store deleted successfully" };
  }

  // ───────────────────────────────────────────────
  // 📊 UPDATE ANALYTICS
  // ───────────────────────────────────────────────
  static async updateStoreAnalytics(
    storeId: string,
    amount: number,
    customerId?: string
  ) {
    const store = await StoreModel.findById(storeId);
    if (!store) throw new NotFoundError("Store not found");

    const now = new Date();
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const month = monthNames[now.getMonth()];
    const year = now.getFullYear();

    const analytics = store.analytics || {
      sales: [],
      orders: [],
      customers: [],
    };

    const findRecord = (arr: any[], key: string) =>
      arr.find((r) => r.month === month && r.year === year);

    const salesRecord = findRecord(analytics.sales, "amount");
    if (salesRecord) salesRecord.amount += amount;
    else analytics.sales.push({ month, year, amount });

    const orderRecord = findRecord(analytics.orders, "count");
    if (orderRecord) orderRecord.count += 1;
    else analytics.orders.push({ month, year, count: 1 });

    if (customerId) {
      const customerRecord = findRecord(analytics.customers, "count");
      if (customerRecord) {
        if (!customerRecord.list.includes(customerId)) {
          customerRecord.list.push(customerId);
          customerRecord.count += 1;
        }
      } else {
        analytics.customers.push({ month, year, count: 1, list: [customerId] });
      }
    }

    const sortByDate = (arr: any[]) =>
      arr.sort(
        (a, b) =>
          a.year - b.year ||
          monthNames.indexOf(a.month) - monthNames.indexOf(b.month)
      );

    analytics.sales = sortByDate(analytics.sales);
    analytics.orders = sortByDate(analytics.orders);
    analytics.customers = sortByDate(analytics.customers);

    const totalRevenue = (Number(store.total_revenue) || 0) + amount;
    const totalOrders = (Number(store.total_orders) || 0) + 1;
    const uniqueCustomers = new Set(
      analytics.customers.flatMap((c: any) => c.list || [])
    ).size;

    await StoreModel.update(storeId, {
      analytics,
      total_revenue: totalRevenue,
      total_orders: totalOrders,
      active_customers: uniqueCustomers,
      updated_at: new Date().toISOString(),
    });

    return analytics;
  }

  // ───────────────────────────────────────────────
  // 📈 GET DASHBOARD ANALYTICS
  // ───────────────────────────────────────────────
  static async getAnalytics(storeId: string) {
    if (!storeId) throw new BadRequestError("Store ID is required");

    const store = await StoreModel.findById(storeId);
    if (!store) throw new NotFoundError("Store not found");

    const analytics = store.analytics || {
      sales: [],
      orders: [],
      customers: [],
    };

    const totalSales = store.total_revenue || 0;
    const totalOrders = store.total_orders || 0;
    const totalCustomers = store.active_customers || 0;
    const conversionRate =
      totalCustomers > 0
        ? parseFloat(((totalOrders / totalCustomers) * 100).toFixed(1))
        : 0;

    const sortedSales = [...(analytics.sales || [])].sort(
      (a, b) =>
        a.year - b.year ||
        [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ].indexOf(a.month) -
          [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ].indexOf(b.month)
    );

    const lastMonth = sortedSales[sortedSales.length - 2];
    const thisMonth = sortedSales[sortedSales.length - 1];

    const getChange = (current: number, previous: number) =>
      previous
        ? parseFloat((((current - previous) / previous) * 100).toFixed(1))
        : 0;

    const salesChange =
      lastMonth && thisMonth
        ? getChange(thisMonth.amount, lastMonth.amount)
        : 0;

    return {
      summary: {
        total_sales: totalSales,
        orders: totalOrders,
        customers: totalCustomers,
        conversion_rate: conversionRate,
        sales_change: salesChange,
        orders_change: 0,
        customers_change: 0,
        conversion_rate_change: 0,
      },
      chart: { sales_trend: sortedSales },
    };
  }

  // ───────────────────────────────────────────────
  // 🏦 BANK ACCOUNT MANAGEMENT
  // ───────────────────────────────────────────────
  static async registerBankAccount(
    storeId: string,
    bank_code: string,
    account_number: string,
    settlement_email?: string
  ) {
    if (!storeId || !bank_code || !account_number)
      throw new BadRequestError("Missing required bank details");

    const store = await StoreModel.findById(storeId);
    if (!store) throw new NotFoundError("Store not found");

    const verified = await verifyBankAccount(account_number, bank_code);
    if (!verified?.account_name)
      throw new BadRequestError("Bank account could not be verified");

    const recipient_code = await createTransferRecipient({
      name: verified.account_name,
      account_number,
      bank_code,
    });

    const updated = await StoreModel.update(storeId, {
      account_number,
      bank_code,
      bank_name: verified.bank_name || verified.account_name,
      recipient_code,
      settlement_email: settlement_email || store.settlement_email,
      updated_at: new Date().toISOString(),
    });

    return {
      success: true,
      message: "Bank account registered successfully",
      store: updated,
    };
  }

  // ───────────────────────────────────────────────
  // 🏦 UPDATE BANK ACCOUNT (strict verification)
  // ───────────────────────────────────────────────
  static async updateBankAccount(
    storeId: string,
    updates: {
      account_number?: string;
      bank_code?: string;
      settlement_email?: string;
    }
  ) {
    if (!storeId) throw new BadRequestError("Store ID is required");

    const store = await StoreModel.findById(storeId);
    if (!store) throw new NotFoundError("Store not found");

    const { account_number, bank_code, settlement_email } = updates;

    // ✅ Require at least one field to change
    if (!account_number && !bank_code && !settlement_email) {
      throw new BadRequestError("No bank details provided for update");
    }

    // ✅ Re-verify only if bank_code or account_number is changing
    let verifiedAccount = null;
    let recipient_code = store.recipient_code;
    let bank_name = store.bank_name;

    const bankDetailsChanged =
      (account_number && account_number !== store.account_number) ||
      (bank_code && bank_code !== store.bank_code);

    if (bankDetailsChanged) {
      const acctNum = account_number || store.account_number;
      const bCode = bank_code || store.bank_code;

      if (!acctNum || !bCode) {
        throw new BadRequestError(
          "Both account number and bank code are required for verification"
        );
      }

      // ✅ Verify bank account with Paystack
      verifiedAccount = await verifyBankAccount(acctNum, bCode);

      if (!verifiedAccount?.account_name) {
        // ❌ Reject update if verification fails
        throw new BadRequestError("Bank verification failed — invalid details");
      }

      // ✅ Create new Paystack transfer recipient
      recipient_code = await createTransferRecipient({
        name: verifiedAccount.account_name,
        account_number: acctNum,
        bank_code: bCode,
      });

      bank_name = verifiedAccount.bank_name || verifiedAccount.account_name;
    }

    // ✅ Only update if verified OR if just settlement_email changed
    if (bankDetailsChanged && !verifiedAccount) {
      throw new BadRequestError("Cannot update — bank verification required");
    }

    const updated = await StoreModel.update(storeId, {
      account_number: account_number || store.account_number,
      bank_code: bank_code || store.bank_code,
      bank_name,
      recipient_code,
      settlement_email: settlement_email || store.settlement_email,
      updated_at: new Date().toISOString(),
    });

    return {
      success: true,
      message: verifiedAccount
        ? "Bank verified and updated successfully"
        : "Settlement email updated successfully",
      store: updated,
      verified: verifiedAccount || null,
    };
  }

  static async deleteBankAccount(storeId: string) {
    const store = await StoreModel.findById(storeId);
    if (!store) throw new NotFoundError("Store not found");

    const cleared = await StoreModel.update(storeId, {
      account_number: null,
      bank_code: null,
      bank_name: null,
      recipient_code: null,
      settlement_email: null,
      updated_at: new Date().toISOString(),
    });

    return {
      success: true,
      message: "Bank account removed successfully",
      store: cleared,
    };
  }
}

export default StoreService;
