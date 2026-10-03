import { AiSettings } from "@/components/settings/AiSettings";
import { AI_PROVIDERS, isAiProvider } from "@/lib/ai-import-format";
import { defaultModel, listModels, providerConfigured } from "@/lib/ai-providers";
import { getSettings } from "@/lib/queries";

export const metadata = { title: "Importar con IA" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const settings = await getSettings();
  // Lista de modelos de cada IA con clave (se pide a la propia IA; en caché 1 h).
  const lists = await Promise.all(AI_PROVIDERS.map((p) => listModels(p.id)));
  return (
    <AiSettings
      current={isAiProvider(settings.aiProvider) ? settings.aiProvider : "claude"}
      providers={AI_PROVIDERS.map((p, i) => ({
        ...p,
        configured: providerConfigured(p.id),
        defaultModel: defaultModel(p.id),
        chosenModel: settings.aiModels[p.id] ?? null,
        models: lists[i] ?? null,
      }))}
    />
  );
}
