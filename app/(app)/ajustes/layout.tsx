import { Toaster } from "@/components/settings/kit";

export default function AjustesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
