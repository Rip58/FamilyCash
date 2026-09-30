import { PendingRequestsList } from "@/components/employee/PendingRequestsList";
import { loadRequests } from "@/lib/employee-file-queries";

export const metadata = { title: "Peticiones" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const requests = await loadRequests();
  return <PendingRequestsList requests={requests} />;
}
