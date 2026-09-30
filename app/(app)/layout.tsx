import { TabBar } from "@/components/ui/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="app-main mx-auto w-full max-w-xl px-4">{children}</main>
      <TabBar />
    </>
  );
}
