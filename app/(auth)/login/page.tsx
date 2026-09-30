import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <h1 className="text-[28px] font-bold tracking-tight">Plantilla Noche</h1>
      <p className="mt-1 mb-8 text-muted">Introduce la contraseña para entrar.</p>
      <LoginForm next={next} />
    </main>
  );
}
