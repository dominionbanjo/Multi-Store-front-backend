declare module "postman-to-openapi" {
  export default function postmanToOpenApi(
    input: string,
    output: string,
    options?: { defaultTag?: string }
  ): Promise<void>;
}
