import { redirect } from "next/navigation";
import { fetchCurrentUserServer } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await fetchCurrentUserServer();
  redirect(user ? "/topics" : "/auth");
}
