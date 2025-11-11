import {
  UserModel,
  StoreModel,
  CartModel,
  WishlistModel,
  ProductModel,
  ProductReviewModel,
  ProductCategoryModel,
  OrderModel,
  DeliveryModel,
  EscrowModel,
  TransactionModel,
} from "../../config/db/models";

/**
 * 🔄 Sync all database models in the correct order
 * Ensures foreign key dependencies are respected
 */
export async function syncAllModels() {
  console.log("🔄 Syncing all database models in dependency order...");

  try {
    // Independent roots
    await ProductCategoryModel.sync();
    await UserModel.sync();

    // Dependent on users
    await StoreModel.sync();

    // Product-related (depend on stores & categories)
    await ProductModel.sync();
    await ProductReviewModel.sync();

    // User-product relationships
    await CartModel.sync();
    await WishlistModel.sync();

    // Order & transaction chain
    await OrderModel.sync();
    await DeliveryModel.sync();
    await EscrowModel.sync();
    await TransactionModel.sync();

    console.log("✅ All models synced successfully!");
  } catch (error) {
    console.error("❌ Failed to sync models:", error);
    throw error;
  }
}

// Optional: allow CLI execution
if (process.argv[1].includes("sync.ts")) {
  syncAllModels()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Sync failed:", err);
      process.exit(1);
    });
}

// import {
//   UserModel,
//   StoreModel,
//   CartModel,
//   WishlistModel,
//   ProductModel,
//   ProductReviewModel,
//   ProductCategoryModel,
//   OrderModel,
//   DeliveryModel,
//   EscrowModel,
// } from "../../config/db/models";

// /**
//  * 🔄 Sync all models in dependency-safe order
//  */
// export async function syncAllModels() {
//   console.log("🔄 Syncing all database models in correct dependency order...");

//   try {
//     // 1️⃣ Independent roots
//     await ProductCategoryModel.sync();
//     await UserModel.sync();

//     // 2️⃣ Store depends on users
//     await StoreModel.sync();

//     // 3️⃣ Product and related models
//     await ProductModel.sync();
//     await ProductReviewModel.sync();

//     // 4️⃣ User-product relationships
//     await CartModel.sync();
//     await WishlistModel.sync();

//     // 5️⃣ Create orders FIRST (without escrow/delivery yet)
//     await OrderModel.sync();

//     // 6️⃣ Then create delivery & escrow (they depend on orders)
//     await DeliveryModel.sync();
//     await EscrowModel.sync();

//     // 7️⃣ Finally, re-add order → escrow & order → delivery FKs manually
//     console.log("🔁 Adding cross-referencing FKs between orders ↔ escrows/deliveries...");
//     await addOrderForeignKeys();

//     console.log("✅ All models synced successfully!");
//   } catch (error) {
//     console.error("❌ Failed to sync models:", error);
//     throw error;
//   }
// }

// // ───────────────────────────────────────────────
// // 🧱 ADD CROSS FOREIGN KEYS (AFTER BOTH TABLES EXIST)
// // ───────────────────────────────────────────────
// import sql from "../../config/connect";

// async function addOrderForeignKeys() {
//   const addFK = async (
//     fkName: string,
//     table: string,
//     column: string,
//     reference: string
//   ) => {
//     const query = `
//       DO $$
//       BEGIN
//         IF NOT EXISTS (
//           SELECT 1 FROM information_schema.table_constraints
//           WHERE constraint_name = '${fkName}'
//         ) THEN
//           ALTER TABLE ${table}
//           ADD CONSTRAINT ${fkName}
//           FOREIGN KEY (${column})
//           REFERENCES ${reference}
//           ON DELETE SET NULL
//           ON UPDATE CASCADE;
//         END IF;
//       END
//       $$;
//     `;
//     await sql.unsafe(query);
//   };

//   // Add orders.escrow_id → escrows.id
//   await addFK("fk_orders_escrow_id", "orders", "escrow_id", "escrows(id)");

//   // Add orders.delivery_id → deliveries.id
//   await addFK("fk_orders_delivery_id", "orders", "delivery_id", "deliveries(id)");
// }

// // Optional: Run directly via CLI
// if (process.argv[1].includes("sync.ts")) {
//   syncAllModels()
//     .then(() => process.exit(0))
//     .catch((err) => {
//       console.error("❌ Sync failed:", err);
//       process.exit(1);
//     });
// }
