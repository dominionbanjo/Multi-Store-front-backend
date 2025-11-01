import { BaseModel } from "./BaseModel.js";

export interface IStore {
  id: string;
  user_id: string;
  store_name: string;
  username: string;
  created_at?: string;
  updated_at?: string;
}

class StoreModelClass extends BaseModel<IStore> {
  protected table = "stores";
}

export const StoreModel = new StoreModelClass();
