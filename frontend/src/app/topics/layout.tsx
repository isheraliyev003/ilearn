import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { fetchCurrentUserServer } from "@/lib/server-api";
import { topicQueryKeys } from "@/lib/topic-queries";

export default async function TopicsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const queryClient = new QueryClient();
  const user = await fetchCurrentUserServer();

  if (!user) {
    redirect("/auth");
  }

  queryClient.setQueryData(topicQueryKeys.currentUser, user);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="min-h-[100dvh]">
        <AppHeader />
        <main>{children}</main>
      </div>
    </HydrationBoundary>
  );
}
