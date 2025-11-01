import { BaseModel } from "./BaseModel.js";

export interface ICart {
  id: string;
  user_id: string;
  product_id: string;
  name: string;
  price: number;
  image?: string | null;
  quantity: number;
  stock: number;
  created_at: string;
  updated_at: string;
}

class CartModelClass extends BaseModel<ICart> {
  protected table = "cart";
}

export const CartModel = new CartModelClass();
