import { v4 as uuidv4 } from "uuid";
import { StoreModel, IStore } from "../config/db/models/StoreModel.js";
import { ProductModel } from "../config/db/models/ProductModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import {
  createTransferRecipient,
  verifyBankAccount,
} from "../utils/payment/paystack.js";

class StoreService {
  /** 🏬 Create a new store (vendor only) */
  static async createStore(
    data: Omit<IStore, "id" | "created_at" | "updated_at">
  ) {
    if (!data.user_id || !data.store_name || !data.username)
      throw new BadRequestError("Missing required store fields");

    const existing = await StoreModel.findOne({ username: data.username });
    if (existing) throw new BadRequestError("Username already taken");

    const store = await StoreModel.create({
      ...data,
      id: uuidv4(),
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
  // 📄 GET SINGLE STORE (WITH CATEGORIES)
  // ───────────────────────────────────────────────
  static async getStore(
    identifier: string
  ): Promise<IStore & { categories: string[] }> {
    const store = await StoreModel.findOne({ id: identifier });

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
        "username",
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
  // 🧭 GET STORE PRODUCTS
  // ───────────────────────────────────────────────
  static async getStoreProducts(storeId: string, page = 1, limit = 20) {
    if (!storeId) throw new BadRequestError("Store ID is required");

    const store = await StoreModel.findById(storeId);
    if (!store) throw new NotFoundError("Store not found");

    const { data, pagination } = await ProductModel.findAll(
      { store_id: storeId },
      { page, limit }
    );

    return { store, products: data, pagination };
  }

  // ───────────────────────────────────────────────
  // ✏️ UPDATE STORE
  // ───────────────────────────────────────────────
  static async updateStore(storeId: string, updates: Partial<IStore>) {
    if (!storeId) throw new BadRequestError("Store ID is required");

    const existing = await StoreModel.findById(storeId);
    if (!existing) throw new NotFoundError("Store not found");

    const updated = await StoreModel.update(storeId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });

    return updated;
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

  static async updateBankAccount(
    storeId: string,
    updates: {
      account_number?: string;
      bank_code?: string;
      bank_name?: string;
      settlement_email?: string;
    }
  ) {
    if (!storeId) throw new BadRequestError("Store ID required");

    const store = await StoreModel.findById(storeId);
    if (!store) throw new NotFoundError("Store not found");

    const updated = await StoreModel.update(storeId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });

    return {
      success: true,
      message: "Bank account details updated",
      store: updated,
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
