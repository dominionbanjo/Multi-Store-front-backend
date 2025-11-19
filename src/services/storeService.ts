import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";
import {
  StoreModel,
  IStore,
  IAnalytics,
  IStoreCustomer,
} from "../config/db/models/StoreModel.js";
import { ProductModel } from "../config/db/models/ProductModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";
import {
  createTransferRecipient,
  verifyBankAccount,
} from "../utils/payment/paystack.js";
import UploadService from "./uploadService.js";
import { ICartItem } from "../config/db/models/CartModel.js";
import { UserModel } from "../config/db/models/index.js";
import { ServiceCache } from "../utils/helpers/ServiceCache.js";

class StoreService {
  // --------------------------------------------------
  // UNIQUE SLUG GENERATOR
  // --------------------------------------------------
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

  // --------------------------------------------------
  // CREATE STORE (invalidate caches)
  // --------------------------------------------------
  static async createStore(
    data: Omit<
      IStore,
      | "id"
      | "slug"
      | "category"
      | "logo_public_id"
      | "cover_image_public_id"
      | "phone_number"
      | "website"
      | "total_revenue"
      | "total_orders"
      | "total_products"
      | "active_customers"
      | "products_listed"
      | "recipient_code"
      | "settlement_email"
      | "payout_verified"
      | "analytics"
      | "customers"
      | "address"
      | "created_at"
      | "updated_at"
      | "account_number"
      | "bank_code"
      | "bank_name"
    >
  ) {
    if (!data.user_id || !data.store_name || !data.email)
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

    // invalidate caches
    await ServiceCache.clear("svc:store");
    await ServiceCache.clear("svc:store:list");
    await ServiceCache.clear("svc:product");

    return store;
  }

  // --------------------------------------------------
  // GET STORE CATEGORIES (CACHED)
  // --------------------------------------------------
  static async getStoreCategories(storeId: string): Promise<string[]> {
    if (!storeId) throw new BadRequestError("Store ID is required");

    const key = ServiceCache.key("store", "categories", storeId);
    const cached = await ServiceCache.get<string[]>(key);
    if (cached) return cached;

    const products = await ProductModel.findSelected(
      ["category"],
      { store_id: storeId },
      { page: 1, limit: 100 }
    );

    const categories = Array.from(
      new Set(products.data.map((p: any) => p.category).filter(Boolean))
    );

    await ServiceCache.set(key, categories);

    return categories;
  }

  // --------------------------------------------------
  // GET STORE (ID OR SLUG) — CACHED
  // --------------------------------------------------
  static async getStore(
    identifier: string
  ): Promise<IStore & { categories: string[] }> {
    if (!identifier) throw new BadRequestError("Store identifier required");

    const key = ServiceCache.key("store", "one", identifier);
    const cached = await ServiceCache.get<any>(key);
    if (cached) return cached;

    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier
      );

    const store = isUUID
      ? await StoreModel.findOne({ id: identifier })
      : await StoreModel.findOne({ slug: identifier });

    if (!store) throw new NotFoundError("Store not found");

    const categories = await StoreService.getStoreCategories(store.id);
    const result = { ...store, categories };

    await ServiceCache.set(key, result);

    return result;
  }

  // --------------------------------------------------
  // GET ALL STORES (CACHED)
  // --------------------------------------------------
  static async getAllStores(page = 1, limit = 20) {
    const key = ServiceCache.key("store", "list", `${page}-${limit}`);
    const cached = await ServiceCache.get<any>(key);
    if (cached) return cached;

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

    const result = { pagination, stores: enrichedStores };

    await ServiceCache.set(key, result);

    return result;
  }

  // --------------------------------------------------
  // GET ALL STORES (ADMIN — FULL DETAILS) — CACHED
  // --------------------------------------------------
  static async getAllStoresAdmin(page = 1, limit = 20) {
    const key = ServiceCache.key("store", "admin-list", `${page}-${limit}`);
    const cached = await ServiceCache.get<any>(key);
    if (cached) return cached;

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

    const result = { pagination, data: enrichedStores };
    await ServiceCache.set(key, result);

    return result;
  }

  // --------------------------------------------------
  // GET STORE PRODUCTS (CACHED)
  // --------------------------------------------------
  static async getStoreProducts(identifier: string, page = 1, limit = 20) {
    if (!identifier) throw new BadRequestError("Store identifier is required");

    const key = ServiceCache.key(
      "store",
      "products",
      `${identifier}-${page}-${limit}`
    );

    const cached = await ServiceCache.get<any>(key);
    if (cached) return cached;

    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier
      );

    const store = isUUID
      ? await StoreModel.findOne({ id: identifier })
      : await StoreModel.findOne({ slug: identifier });

    if (!store) throw new NotFoundError("Store not found");

    const { data, pagination } = await ProductModel.findAll(
      { store_id: store.id },
      { page, limit }
    );

    const result = { pagination, products: data };
    await ServiceCache.set(key, result);

    return result;
  }

  // --------------------------------------------------
  // UPDATE STORE (CLEAR CACHE)
  // --------------------------------------------------
  static async updateStore(
    storeId: string,
    data: Record<string, any>,
    files?: {
      logo?: Express.Multer.File;
      cover_image?: Express.Multer.File;
    }
  ) {
    if (!storeId) throw new BadRequestError("Store ID is required");

    const existingStore = await StoreModel.findById(storeId);
    if (!existingStore) throw new NotFoundError("Store not found");

    const allowedFields = [
      "store_name",
      "description",
      "category",
      "category_ids",
      "email",
      "phone_number",
      "website",
      "address",
      "logo",
      "logo_public_id",
      "cover_image",
      "cover_image_public_id",
    ];

    const filtered: Record<string, any> = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) filtered[key] = data[key];
    }

    // LOGO UPLOAD
    if (files?.logo) {
      const logoUpload = await UploadService.uploadSingle(
        files.logo,
        "easystore/stores/logos"
      );

      filtered.logo = logoUpload?.url;
      filtered.logo_public_id = logoUpload?.public_id;

      if (existingStore.logo_public_id) {
        await UploadService.deleteSingle(existingStore.logo_public_id);
      }
    }

    // COVER UPLOAD
    if (files?.cover_image) {
      const coverUpload = await UploadService.uploadSingle(
        files.cover_image,
        "easystore/stores/covers"
      );

      filtered.cover_image = coverUpload?.url;
      filtered.cover_image_public_id = coverUpload?.public_id;

      if (existingStore.cover_image_public_id) {
        await UploadService.deleteSingle(existingStore.cover_image_public_id);
      }
    }

    // RENAME SLUG IF store_name changed
    if (
      filtered.store_name &&
      filtered.store_name.toLowerCase() !==
        existingStore.store_name.toLowerCase()
    ) {
      const duplicate = await StoreModel.findOne({
        store_name: filtered.store_name,
      });

      if (duplicate && duplicate.id !== storeId) {
        throw new BadRequestError("Store name already in use");
      }

      filtered.slug = await this.generateUniqueSlug(filtered.store_name);
    }

    const updated = await StoreModel.update(storeId, {
      ...filtered,
      updated_at: new Date().toISOString(),
    });

    // CLEAR ALL CACHES SINCE STORE DETAILS CHANGED
    await ServiceCache.clear("svc:store");
    await ServiceCache.clear("svc:store:list");
    await ServiceCache.clear("svc:store:categories");
    await ServiceCache.clear("svc:store:products");
    await ServiceCache.clear("svc:store:analytics");

    return updated;
  }

  // --------------------------------------------------
  // DELETE STORE (CLEAR CACHE)
  // --------------------------------------------------
  static async deleteStore(storeId: string) {
    if (!storeId) throw new BadRequestError("Store ID is required");

    const existing = await StoreModel.findById(storeId);
    if (!existing) throw new NotFoundError("Store not found");

    await StoreModel.delete(storeId);

    await ServiceCache.clear("svc:store");
    await ServiceCache.clear("svc:store:list");
    await ServiceCache.clear("svc:store:categories");
    await ServiceCache.clear("svc:store:products");
    await ServiceCache.clear("svc:store:analytics");

    return { success: true, message: "Store deleted successfully" };
  }

  static async storeNameExists(store_name: string): Promise<boolean> {
    const cleaned = store_name.trim().toLowerCase();
    const existing = await StoreModel.findOne({ store_name: cleaned });
    return existing ? true : false;
  }

  // --------------------------------------------------
  // UPDATE STORE ANALYTICS (CLEAR CACHE)
  // --------------------------------------------------
  static async updateStoreAnalytics(
    storeId: string,
    amount: number,
    customerId: string,
    orderItems: ICartItem[]
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
    const today = now.toISOString();

    const analytics = store.analytics || {
      sales: [],
      orders: [],
      customers: [],
    };

    const customers = store.customers || [];

    const findRec = (arr: any[]) =>
      arr.find((r) => r.month === month && r.year === year);

    // SALES
    const salesRec = findRec(analytics.sales);
    if (salesRec) salesRec.amount += amount;
    else analytics.sales.push({ month, year, amount });

    // ORDERS
    const orderRec = findRec(analytics.orders);
    if (orderRec) orderRec.count += 1;
    else analytics.orders.push({ month, year, count: 1 });

    // CUSTOMERS (monthly unique)
    const custRec = findRec(analytics.customers);
    if (custRec) {
      if (!custRec.list.includes(customerId)) {
        custRec.list.push(customerId);
        custRec.count += 1;
      }
    } else {
      analytics.customers.push({
        month,
        year,
        count: 1,
        list: [customerId],
      });
    }

    // UPDATE CUSTOMER LIST
    const customer = await UserModel.findById(customerId).catch(() => null);

    const fullCustomerName = `${customer?.first_name ?? ""} ${
      customer?.last_name ?? ""
    }`.trim();

    const location =
      customer?.address?.city ||
      customer?.address?.state ||
      customer?.address?.country ||
      null;

    const existingCustomer = customers.find((c) => c.id === customerId);

    if (existingCustomer) {
      existingCustomer.orders += 1;
      existingCustomer.spent += amount;
      existingCustomer.last_order_date = today;
    } else {
      customers.push({
        id: customerId,
        name: fullCustomerName,
        email: customer?.email ?? "",
        phone_number: customer?.phone_number ?? null,
        location,
        orders: 1,
        spent: amount,
        rating: 0,
        last_order_date: today,
      });
    }

    const uniqueCustomers = customers.length;

    await StoreModel.update(storeId, {
      analytics,
      customers,
      total_revenue: Number(store.total_revenue || 0) + amount,
      total_orders: Number(store.total_orders || 0) + 1,
      active_customers: uniqueCustomers,
      updated_at: new Date().toISOString(),
    });

    // CLEAR ONLY ANALYTICS + STORE (details)
    await ServiceCache.clear("svc:store:analytics");
    await ServiceCache.clear("svc:store");
    await ServiceCache.clear("svc:store:list");

    return analytics;
  }

  // --------------------------------------------------
  // GET ANALYTICS (CACHED)
  // --------------------------------------------------
  static async getAnalytics(storeId: string, userId: string, role: string) {
    if (!storeId) throw new BadRequestError("Store ID is required");

    const key = ServiceCache.key("store", "analytics", storeId);
    const cached = await ServiceCache.get<any>(key);
    if (cached) return cached;

    const store = await StoreModel.findById(storeId);
    if (!store) throw new NotFoundError("Store not found");

    if (role === "vendor" && store.user_id !== userId) {
      throw new BadRequestError(
        "You are not allowed to view this store's analytics"
      );
    }

    const analytics: IAnalytics = store.analytics || {
      sales: [],
      orders: [],
      customers: [],
    };

    const customers: IStoreCustomer[] = store.customers || [];

    const totalSales = store.total_revenue || 0;
    const totalOrders = store.total_orders || 0;
    const totalCustomers = store.active_customers || 0;

    const conversionRate =
      totalCustomers > 0
        ? parseFloat(((totalOrders / totalCustomers) * 100).toFixed(1))
        : 0;

    const monthOrder = [
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

    const sortedSales = [...analytics.sales].sort(
      (a, b) =>
        a.year - b.year ||
        monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
    );

    const lastMonth = sortedSales[sortedSales.length - 2];
    const thisMonth = sortedSales[sortedSales.length - 1];

    const getChange = (cur: number, prev: number) =>
      prev ? parseFloat((((cur - prev) / prev) * 100).toFixed(1)) : 0;

    const salesChange =
      lastMonth && thisMonth
        ? getChange(thisMonth.amount, lastMonth.amount)
        : 0;

    const { data: topProducts } = await ProductModel.findAll(
      { store_id: storeId },
      { page: 1, limit: 10, orderBy: "total_sold DESC" }
    );

    const result = {
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
      chart: {
        sales_trend: sortedSales,
        orders_trend: analytics.orders || [],
        customers_trend: analytics.customers || [],
      },
      top_products: topProducts,
      customers,
      analytics,
    };

    await ServiceCache.set(key, result);
    return result;
  }

  // --------------------------------------------------
  // BANK ACCOUNT MANAGEMENT — with cache invalidation
  // --------------------------------------------------
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
      payout_verified: true,
      updated_at: new Date().toISOString(),
    });

    // CLEAR store caches
    await ServiceCache.clear("svc:store");
    await ServiceCache.clear("svc:store:list");

    return {
      success: true,
      message: "Bank account registered successfully",
      store: updated,
    };
  }

  // --------------------------------------------------
  // UPDATE BANK ACCOUNT — strict verification
  // --------------------------------------------------
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

    if (!account_number && !bank_code && !settlement_email) {
      throw new BadRequestError("No bank details provided for update");
    }

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

    if (bankDetailsChanged && !verifiedAccount) {
      throw new BadRequestError("Cannot update — bank verification required");
    }

    const updated = await StoreModel.update(storeId, {
      account_number: account_number || store.account_number,
      bank_code: bank_code || store.bank_code,
      bank_name,
      recipient_code,
      payout_verified: true,
      settlement_email: settlement_email || store.settlement_email,
      updated_at: new Date().toISOString(),
    });

    // CLEAR store caches
    await ServiceCache.clear("svc:store");
    await ServiceCache.clear("svc:store:list");

    return {
      success: true,
      message: verifiedAccount
        ? "Bank verified and updated successfully"
        : "Settlement email updated successfully",
      store: updated,
      verified: verifiedAccount || null,
    };
  }

  // --------------------------------------------------
  // DELETE BANK ACCOUNT — with cache invalidation
  // --------------------------------------------------
  static async deleteBankAccount(storeId: string) {
    const store = await StoreModel.findById(storeId);
    if (!store) throw new NotFoundError("Store not found");

    const cleared = await StoreModel.update(storeId, {
      account_number: null,
      bank_code: null,
      bank_name: null,
      recipient_code: null,
      settlement_email: null,
      payout_verified: false,
      updated_at: new Date().toISOString(),
    });

    // CLEAR store caches
    await ServiceCache.clear("svc:store");
    await ServiceCache.clear("svc:store:list");

    return {
      success: true,
      message: "Bank account removed successfully",
      store: cleared,
    };
  }
}

export default StoreService;
