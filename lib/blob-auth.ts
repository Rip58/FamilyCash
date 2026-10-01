/**
 * Credenciales de Vercel Blob (puro, testeable). Vercel conecta un almacén de dos formas:
 *  - clásica: `BLOB_READ_WRITE_TOKEN` (o `<PREFIJO>_READ_WRITE_TOKEN` si se eligió un prefijo);
 *  - nueva: `BLOB_STORE_ID` (o `<PREFIJO>_STORE_ID`) + el token OIDC automático de Vercel.
 * Devuelve las opciones a pasar a `put`/`get`/`del`, o null si no hay almacén.
 */
export type BlobAuth = { token: string } | { storeId: string };

type Env = Record<string, string | undefined>;

function find(env: Env, exact: string, suffix: string, valuePrefix: string): string | undefined {
  const direct = env[exact]?.trim();
  if (direct) return direct;
  for (const [k, v] of Object.entries(env)) {
    const val = v?.trim();
    if (k.endsWith(suffix) && val?.startsWith(valuePrefix)) return val;
  }
  return undefined;
}

export function blobAuth(env: Env = process.env): BlobAuth | null {
  const token = find(env, "BLOB_READ_WRITE_TOKEN", "_READ_WRITE_TOKEN", "vercel_blob_rw_");
  if (token) return { token };
  const storeId = find(env, "BLOB_STORE_ID", "_STORE_ID", "store_");
  if (storeId) return { storeId };
  return null;
}
