import { BaseModel } from "./BaseModel.js";

export interface IUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password?: string | null;
  phone_number?: string | null;
  account_type: string;
  store_name?: string | null;
  username?: string | null;
  referral_code?: string | null;
  current_sales_channel?: string | null;
  agree_to_terms?: boolean | null;
  email_verified?: boolean | null;

  password_token?: string | null;
  password_token_expiration_date?: string | null;
  email_verification_code?: string | null;
  email_verification_expiration?: string | null;

  otp?: string | null;
  otp_expiration?: string | null;
  signup_medium?: string | null;

  avatar?: string | null;
  avatar_public_id?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
}

class UserModelClass extends BaseModel<IUser> {
  protected table = "users";
}

export const UserModel = new UserModelClass();
