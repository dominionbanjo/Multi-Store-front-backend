import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";
import {
  ProductCategoryModel,
  IProductCategory,
} from "../config/db/models/ProductCategoryModel.js";
import { BadRequestError, NotFoundError } from "../utils/errors/customError.js";

class ProductCategoryService {
  /**
   * ➕ Create a new product category
   */
  static async createCategory(data: Partial<IProductCategory>) {
    if (!data.name) throw new BadRequestError("Category name is required");

    // Check duplicate name
    const existing = await ProductCategoryModel.findOne({ name: data.name });
    if (existing) throw new BadRequestError("Category name already exists");

    const slug = data.slug || slugify(data.name, { lower: true, strict: true });

    // Check duplicate slug
    const existingSlug = await ProductCategoryModel.findOne({ slug });
    if (existingSlug) throw new BadRequestError("Category slug already exists");

    const newCategory = await ProductCategoryModel.create({
      id: uuidv4(),
      name: data.name,
      slug,
      parent_id: data.parent_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    return newCategory;
  }

  /**
   * 🧾 Get all categories
   */
  static async getAllCategories() {
    const { data } = await ProductCategoryModel.findAll({}, { limit: 1000 });
    return data;
  }

  /**
   * 🔍 Get single category by ID or slug
   */
  static async getCategory(identifier: string) {
    if (!identifier) throw new BadRequestError("Category identifier required");

    const isUUID = /^[0-9a-f-]{36}$/.test(identifier);
    const category = isUUID
      ? await ProductCategoryModel.findOne({ id: identifier })
      : await ProductCategoryModel.findOne({ slug: identifier });

    if (!category) throw new NotFoundError("Category not found");
    return category;
  }

  /**
   * ✏️ Update category
   */
  static async updateCategory(id: string, data: Partial<IProductCategory>) {
    if (!id) throw new BadRequestError("Category ID required");

    const category = await ProductCategoryModel.findById(id);
    if (!category) throw new NotFoundError("Category not found");

    const updates: Partial<IProductCategory> = {};

    if (data.name && data.name !== category.name) {
      const duplicate = await ProductCategoryModel.findOne({ name: data.name });
      if (duplicate && duplicate.id !== id)
        throw new BadRequestError("Category name already in use");

      updates.name = data.name;
      updates.slug = slugify(data.name, { lower: true, strict: true });
    }

    if (data.parent_id !== undefined) updates.parent_id = data.parent_id;

    const updated = await ProductCategoryModel.update(id, {
      ...updates,
      updated_at: new Date().toISOString(),
    });

    return updated;
  }

  /**
   * ❌ Delete category
   */
  static async deleteCategory(id: string) {
    if (!id) throw new BadRequestError("Category ID required");

    const category = await ProductCategoryModel.findById(id);
    if (!category) throw new NotFoundError("Category not found");

    await ProductCategoryModel.delete(id);

    return { success: true, message: "Category deleted successfully" };
  }

  /**
   * 📂 Get subcategories of a parent
   */
  static async getSubcategories(parent_id: string) {
    if (!parent_id) throw new BadRequestError("Parent ID required");

    const subcategories = await ProductCategoryModel.getSubcategories(
      parent_id
    );
    return subcategories;
  }
}

export default ProductCategoryService;
