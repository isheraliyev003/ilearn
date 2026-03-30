import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { fetchTopicsServer } from "@/lib/server-api";
import { topicQueryKeys } from "@/lib/topic-queries";
import { TopicsClient } from "./topics-client";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const queryClient = new QueryClient();
  let topicsError: string | null = null;

  try {
    await queryClient.prefetchQuery({
      queryKey: topicQueryKeys.all,
      queryFn: fetchTopicsServer,
    });
  } catch (e) {
    topicsError =
      e instanceof Error ? e.message : "Could not load topics from the server";
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TopicsClient topicsError={topicsError} />
    </HydrationBoundary>
  );
}
