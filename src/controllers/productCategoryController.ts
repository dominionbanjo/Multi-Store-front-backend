import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import ProductCategoryService from "../services/productCategoryService.js";

export const createCategory = async (req: Request, res: Response) => {
  const category = await ProductCategoryService.createCategory(req.body);
  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Category created successfully",
    data: category,
  });
};

export const getAllCategories = async (_req: Request, res: Response) => {
  const categories = await ProductCategoryService.getAllCategories();
  res.status(StatusCodes.OK).json({
    success: true,
    message: "Categories retrieved successfully",
    data: categories,
  });
};

export const getCategory = async (req: Request, res: Response) => {
  const { idOrSlug } = req.params;
  const category = await ProductCategoryService.getCategory(idOrSlug);
  res.status(StatusCodes.OK).json({
    success: true,
    message: "Category retrieved successfully",
    data: category,
  });
};

export const updateCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = await ProductCategoryService.updateCategory(id, req.body);
  res.status(StatusCodes.OK).json({
    success: true,
    message: "Category updated successfully",
    data: updated,
  });
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ProductCategoryService.deleteCategory(id);
  res.status(StatusCodes.OK).json(result);
};

export const getSubcategories = async (req: Request, res: Response) => {
  const { idOrSlug } = req.params;
  const subcategories = await ProductCategoryService.getSubcategories(idOrSlug);
  res.status(StatusCodes.OK).json({
    success: true,
    message: "Subcategories retrieved successfully",
    data: subcategories,
  });
};
