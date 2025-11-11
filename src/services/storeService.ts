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
      analytics: { sales: [], orders: [], customers: [] }, // Initialize structure
    });

    return store;
  }

  /** 📄 Get a store by ID or username */
  static async getStore(identifier: string): Promise<IStore> {
    const store =
      (await StoreModel.findOne({ id: identifier })) ||
      (await StoreModel.findOne({ username: identifier }));

    if (!store) throw new NotFoundError("Store not found");
    return store;
  }

  /** 🧾 Get all stores (paginated) */
  static async getAllStores(page = 1, limit = 20) {
    const { data, pagination } = await StoreModel.findAll({}, { page, limit });
    return { stores: data, pagination };
  }

  /** 🧭 Get all products for a store */
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

  /** ✏️ Update a store */
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

  /** ❌ Delete a store */
  static async deleteStore(storeId: string) {
    if (!storeId) throw new BadRequestError("Store ID is required");

    const existing = await StoreModel.findById(storeId);
    if (!existing) throw new NotFoundError("Store not found");

    await StoreModel.delete(storeId);
    return { success: true, message: "Store deleted successfully" };
  }

  // ───────────────────────────────────────────────
  // 📊 HELPER: Update or insert analytics record
  // ───────────────────────────────────────────────

  /** 🔧 Add analytics record for sales, orders, and customers */
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

    // Initialize analytics if empty
    const analytics = store.analytics || {
      sales: [],
      orders: [],
      customers: [],
    };

    // 🔹 Update Sales
    const salesRecord = analytics.sales.find(
      (r: any) => r.month === month && r.year === year
    );
    if (salesRecord) salesRecord.amount += amount;
    else analytics.sales.push({ month, year, amount });

    // 🔹 Update Orders
    const orderRecord = analytics.orders.find(
      (r: any) => r.month === month && r.year === year
    );
    if (orderRecord) orderRecord.count += 1;
    else analytics.orders.push({ month, year, count: 1 });

    // 🔹 Update Customers
    if (customerId) {
      const customerRecord = analytics.customers.find(
        (r: any) => r.month === month && r.year === year
      );
      if (customerRecord) {
        if (!customerRecord.list.includes(customerId)) {
          customerRecord.list.push(customerId);
          customerRecord.count += 1;
        }
      } else {
        analytics.customers.push({ month, year, count: 1, list: [customerId] });
      }
    }

    // Sort by year and month
    const sortByDate = (arr: any[]) =>
      arr.sort(
        (a, b) =>
          a.year - b.year ||
          monthNames.indexOf(a.month) - monthNames.indexOf(b.month)
      );

    analytics.sales = sortByDate(analytics.sales);
    analytics.orders = sortByDate(analytics.orders);
    analytics.customers = sortByDate(analytics.customers);

    // Update cached totals
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

    const salesTrend = analytics.sales || [];
    const sortedSales = [...salesTrend].sort(
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
        orders_change: 0, // placeholder – can compute from analytics.orders
        customers_change: 0,
        conversion_rate_change: 0,
      },
      chart: {
        sales_trend: sortedSales,
      },
    };
  }

  // ───────────────────────────────────────────────
  // 🏦 BANK ACCOUNT MANAGEMENT
  // ───────────────────────────────────────────────

  /** 🏦 Add and verify bank account (Paystack recipient) */
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

  /** ✏️ Update existing payout details (non-Paystack re-registration) */
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

  /** ❌ Remove store’s payout info */
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
