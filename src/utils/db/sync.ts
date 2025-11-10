// src/utils/db/sync.ts
import {
  UserModel,
  StoreModel,
  CartModel,
  WishlistModel,
  ProductModel,
  ProductReviewModel,
  ProductCategoryModel,
} from "../../config/db/models";

/**
 * 🔄 Sync all database models in any order
 * ✅ Tables are created first
 * ✅ Foreign keys are added later (inside BaseModel)
 */
export async function syncAllModels() {
  console.log("🔄 Syncing all database models (any order safe)...");

  try {
    await Promise.all([
      ProductCategoryModel.sync(),
      UserModel.sync(),
      StoreModel.sync(),
      ProductModel.sync(),
      ProductReviewModel.sync(),
      CartModel.sync(),
      WishlistModel.sync(),
    ]);

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
