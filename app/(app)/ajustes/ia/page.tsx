import { AiSettings } from "@/components/settings/AiSettings";
import { AI_PROVIDERS, isAiProvider } from "@/lib/ai-import-format";
import { providerConfigured, providerModel } from "@/lib/ai-providers";
import { getSettings } from "@/lib/queries";

export const metadata = { title: "Importar con IA" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const settings = await getSettings();
  return (
    <AiSettings
      current={isAiProvider(settings.aiProvider) ? settings.aiProvider : "claude"}
      providers={AI_PROVIDERS.map((p) => ({ ...p, configured: providerConfigured(p.id), model: providerModel(p.id) }))}
    />
  );
}
