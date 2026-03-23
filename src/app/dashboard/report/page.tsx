import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { MarketWorkbench } from "@/components/market-workbench";

export default async function DashboardReportPage() {
  const token = (await cookies()).get("app-access-token")?.value;
  if (!token) {
    redirect("/");
  }

  return <MarketWorkbench initialView="report" />;
}
