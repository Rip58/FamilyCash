/**
 * Llamadas a la IA para leer el cuadrante de una imagen (solo servidor). Las claves van en variables de
 * entorno de Vercel: ANTHROPIC_API_KEY (Claude), OPENAI_API_KEY (ChatGPT) y GEMINI_API_KEY (Gemini). Nunca se envían al cliente.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { AiProvider } from "./ai-import-format";
import { geminiFallbackModel, geminiSchema } from "./ai-import";

export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5";
// Alias de Google que apunta siempre al Flash más reciente (los modelos con versión se retiran).
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

const geminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

export function providerConfigured(p: AiProvider): boolean {
  if (p === "gemini") return !!geminiKey();
  return p === "claude" ? !!process.env.ANTHROPIC_API_KEY : !!process.env.OPENAI_API_KEY;
}

/** Modelo por defecto (variable de entorno o el de la app). */
export function defaultModel(p: AiProvider): string {
  return p === "claude" ? CLAUDE_MODEL : p === "gemini" ? GEMINI_MODEL : OPENAI_MODEL;
}

/** Modelo a usar: el elegido en Ajustes → Importar con IA o, si no hay, el de por defecto. */
export function providerModel(p: AiProvider, chosen?: Partial<Record<string, string>> | null): string {
  return chosen?.[p]?.trim() || defaultModel(p);
}

export interface ModelOption {
  id: string;
  label: string;
}

/**
 * Modelos que la clave puede usar, pedidos a la propia IA (así la lista está siempre al día).
 * null si no hay clave o no responde; la pantalla deja escribir el nombre a mano.
 */
export async function listModels(p: AiProvider): Promise<ModelOption[] | null> {
  if (!providerConfigured(p)) return null;
  const signal = AbortSignal.timeout(6000);
  try {
    if (p === "gemini") {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
        headers: { "x-goog-api-key": geminiKey() },
        signal,
        next: { revalidate: 3600 },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
      };
      return (body.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => ({ id: m.name.replace(/^models\//, ""), label: m.displayName ?? m.name }))
        .filter((m) => m.id.startsWith("gemini") && !/(embedding|tts|image|live|audio|aqa|robotics|computer)/i.test(m.id))
        .sort((a, b) => b.id.localeCompare(a.id, "en", { numeric: true }));
    }
    if (p === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        signal,
        next: { revalidate: 3600 },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: { id: string }[] };
      return (body.data ?? [])
        .map((m) => m.id)
        .filter((id) => /^(gpt-|o\d)/.test(id) && !/(audio|realtime|tts|transcribe|search|image|instruct|codex)/i.test(id))
        .sort((a, b) => b.localeCompare(a, "en", { numeric: true }))
        .map((id) => ({ id, label: id }));
    }
    const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
      signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { id: string; display_name?: string }[] };
    return (body.data ?? []).map((m) => ({ id: m.id, label: m.display_name ?? m.id }));
  } catch {
    return null;
  }
}

/** Error con mensaje para mostrar al usuario (en español). */
export class AiImportError extends Error {}

export interface ImageInput {
  /** Base64 sin prefijo data:. */
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

/** Lee las imágenes (partes de la misma semana) con la IA elegida y devuelve la salida validada con `schema`. */
export async function extractWithAi<S extends z.ZodType>(
  provider: AiProvider,
  model: string,
  images: ImageInput[],
  prompt: string,
  schema: S,
): Promise<z.infer<S>> {
  if (!providerConfigured(provider)) {
    const [name, env] =
      provider === "claude" ? ["Claude", "ANTHROPIC_API_KEY"] : provider === "gemini" ? ["Gemini", "GEMINI_API_KEY"] : ["ChatGPT", "OPENAI_API_KEY"];
    throw new AiImportError(
      `Falta la clave de ${name}: añade ${env} en Vercel → Settings → Environment Variables y vuelve a publicar.`,
    );
  }
  if (provider === "gemini") return extractWithGemini(model, images, prompt, schema);
  return provider === "claude"
    ? extractWithClaude(model, images, prompt, schema)
    : extractWithOpenAI(model, images, prompt, schema);
}

async function extractWithClaude<S extends z.ZodType>(model: string, images: ImageInput[], prompt: string, schema: S): Promise<z.infer<S>> {
  const client = new Anthropic({ timeout: 110_000, maxRetries: 1 });
  try {
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      // Si el modelo rechaza la petición, la API la reintenta en otro modelo recomendado.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: betaZodOutputFormat(schema) },
      messages: [
        {
          role: "user",
          content: [
            ...images.map((image) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: image.mediaType, data: image.data },
            })),
            { type: "text", text: prompt },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") throw new AiImportError("Claude no ha querido procesar la imagen. Prueba con otra captura.");
    if (response.stop_reason === "max_tokens") throw new AiImportError("La respuesta de Claude se cortó: prueba con una imagen de una sola semana.");
    if (!response.parsed_output) throw new AiImportError("Claude no devolvió el cuadrante en el formato esperado. Inténtalo de nuevo.");
    return response.parsed_output as z.infer<S>;
  } catch (e) {
    if (e instanceof AiImportError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiImportError("La clave de Claude (ANTHROPIC_API_KEY) no es válida.");
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiImportError("La clave de Claude no tiene permiso para este modelo.");
    if (e instanceof Anthropic.RateLimitError) throw new AiImportError("Claude está saturado o sin saldo. Espera un momento y reinténtalo.");
    if (e instanceof Anthropic.BadRequestError) throw new AiImportError(`Claude rechazó la petición: ${e.message.slice(0, 200)}`);
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new AiImportError("Claude ha tardado demasiado. Reinténtalo.");
    if (e instanceof Anthropic.APIError) throw new AiImportError(`Error de Claude (${e.status ?? "red"}). Reinténtalo.`);
    throw e;
  }
}

/** OpenAI exige en modo estricto additionalProperties:false y todas las propiedades en `required`. */
function strictJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictJsonSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) if (k !== "$schema") out[k] = strictJsonSchema(v);
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties);
  }
  return out;
}

async function extractWithOpenAI<S extends z.ZodType>(model: string, images: ImageInput[], prompt: string, schema: S): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      signal: AbortSignal.timeout(110_000),
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...images.map((image) => ({
                type: "image_url",
                image_url: { url: `data:${image.mediaType};base64,${image.data}`, detail: "high" },
              })),
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "cuadrante", strict: true, schema: strictJsonSchema(z.toJSONSchema(schema)) },
        },
      }),
    });
  } catch {
    throw new AiImportError("No se pudo contactar con ChatGPT (o ha tardado demasiado). Reinténtalo.");
  }
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  } | null;
  if (res.status === 401) throw new AiImportError("La clave de ChatGPT (OPENAI_API_KEY) no es válida.");
  if (res.status === 429) throw new AiImportError("ChatGPT está saturado o sin saldo. Espera un momento y reinténtalo.");
  if (!res.ok) throw new AiImportError(`Error de ChatGPT (${res.status}): ${body?.error?.message?.slice(0, 200) ?? "sin detalle"}`);
  const choice = body?.choices?.[0];
  if (choice?.message?.refusal) throw new AiImportError("ChatGPT no ha querido procesar la imagen. Prueba con otra captura.");
  if (choice?.finish_reason === "length") throw new AiImportError("La respuesta de ChatGPT se cortó: prueba con una imagen de una sola semana.");
  let json: unknown;
  try {
    json = JSON.parse(choice?.message?.content ?? "");
  } catch {
    throw new AiImportError("ChatGPT no devolvió el cuadrante en el formato esperado. Inténtalo de nuevo.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new AiImportError("ChatGPT devolvió datos que no cuadran con la plantilla. Inténtalo de nuevo.");
  return parsed.data;
}

async function extractWithGemini<S extends z.ZodType>(
  model: string,
  images: ImageInput[],
  prompt: string,
  schema: S,
  retried = false,
  highRes = true,
): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": geminiKey() },
      signal: AbortSignal.timeout(110_000),
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [...images.map((image) => ({ inline_data: { mime_type: image.mediaType, data: image.data } })), { text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: geminiSchema(z.toJSONSchema(schema)),
          temperature: 0,
          // Máxima resolución de imagen: el cuadrante tiene texto pequeño y colores parecidos.
          ...(highRes ? { mediaResolution: "MEDIA_RESOLUTION_HIGH" } : {}),
        },
      }),
    });
  } catch {
    throw new AiImportError("No se pudo contactar con Gemini (o ha tardado demasiado). Reinténtalo.");
  }
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string; status?: string };
    promptFeedback?: { blockReason?: string };
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  } | null;
  const msg = body?.error?.message ?? "";
  // Modelo retirado o inexistente: se prueba una vez con el que sugiere Google o el Flash más nuevo de la cuenta.
  if (res.status === 404 && !retried) {
    const available = ((await listModels("gemini")) ?? []).map((m) => m.id);
    const next = geminiFallbackModel(msg, available, model);
    if (next) return extractWithGemini(next, images, prompt, schema, true, highRes);
  }
  // Algún modelo no acepta la opción de resolución: se repite sin ella.
  if (res.status === 400 && highRes && /media.?resolution/i.test(msg)) {
    return extractWithGemini(model, images, prompt, schema, retried, false);
  }
  if (res.status === 400 && /api key/i.test(msg)) throw new AiImportError("La clave de Gemini (GEMINI_API_KEY) no es válida.");
  if (res.status === 401 || res.status === 403) throw new AiImportError("La clave de Gemini (GEMINI_API_KEY) no es válida o no tiene permiso.");
  if (res.status === 429) throw new AiImportError("Gemini: has llegado al límite gratuito. Espera un rato (o mañana) y reinténtalo.");
  if (!res.ok) throw new AiImportError(`Error de Gemini (${res.status}): ${msg.slice(0, 200) || "sin detalle"}`);
  if (body?.promptFeedback?.blockReason) throw new AiImportError("Gemini no ha querido procesar la imagen. Prueba con otra captura.");
  const cand = body?.candidates?.[0];
  if (cand?.finishReason === "MAX_TOKENS") throw new AiImportError("La respuesta de Gemini se cortó: prueba con una imagen de una sola semana.");
  let json: unknown;
  try {
    json = JSON.parse((cand?.content?.parts ?? []).map((p) => p.text ?? "").join(""));
  } catch {
    throw new AiImportError("Gemini no devolvió el cuadrante en el formato esperado. Inténtalo de nuevo.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new AiImportError("Gemini devolvió datos que no cuadran con la plantilla. Inténtalo de nuevo.");
  return parsed.data;
}
