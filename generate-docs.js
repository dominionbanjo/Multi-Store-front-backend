import fs from "fs-extra";
import converter from "api-spec-converter";

const postmanCollection = "./swagger.json";
const outputSwaggerFile = "./swagger3.json";
const baseUrl = "https://easystore-backend.onrender.com";

/**
 * Replace placeholders like {{base_url}} in the Postman JSON
 */
async function preprocessPostman(collectionPath, baseUrl) {
  const data = await fs.readFile(collectionPath, "utf8");
  const replaced = data.replace(/{{[^}]+}}/g, baseUrl);
  const tmp = "./temp_postman_resolved.json";
  await fs.writeFile(tmp, replaced, "utf8");
  return tmp;
}

async function generateDocs() {
  try {
    console.log("📦 Preprocessing Postman collection...");
    const tempFile = await preprocessPostman(postmanCollection, baseUrl);

    console.log("🔁 Converting Postman → OpenAPI...");
    const result = await converter.convert({
      from: "postman",
      to: "openapi_3",
      source: fs.readFileSync(tempFile, "utf8"),
    });

    const spec = result.spec;
    spec.openapi = "3.0.0";
    spec.info = spec.info || {};
    spec.info.title = spec.info.title || "EasyStore API Docs";
    spec.info.version = spec.info.version || "1.0.0";
    spec.servers = [{ url: baseUrl }];

    await fs.writeJson(outputSwaggerFile, spec, { spaces: 2 });
    console.log("✅ Swagger spec generated successfully:", outputSwaggerFile);
  } catch (err) {
    console.error("❌ Conversion failed:", err);
  }
}

generateDocs();
