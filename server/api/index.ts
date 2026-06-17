/**
 * Vercel serverless entrypoint.
 *
 * Vercel's Node runtime bundles this file with esbuild, which resolves our
 * extensionless relative imports (./env, ./routes/*) at BUILD time. A plain
 * file-by-file tsc emit does not — it leaves `import "./env"` in the output,
 * which Node's ESM loader rejects at runtime (ERR_MODULE_NOT_FOUND). Bundling
 * fixes that. The default-exported Express app is used as the request handler.
 *
 * Locally we still run src/index.ts directly via tsx (npm run dev / start).
 */
import app from "../src/index";

export default app;
