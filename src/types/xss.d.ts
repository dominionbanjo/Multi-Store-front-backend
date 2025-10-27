declare module "xss" {
  import { RequestHandler } from "express";
  const xss: () => RequestHandler;
  export default xss;
}
