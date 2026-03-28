import { TopicsClient } from "./topics-client";
import { fetchTopicsServer } from "@/lib/server-api";

export default async function TopicsPage() {
  let initialTopics: Awaited<ReturnType<typeof fetchTopicsServer>> = [];
  let topicsError: string | null = null;

  try {
    initialTopics = await fetchTopicsServer();
  } catch (e) {
    topicsError =
      e instanceof Error ? e.message : "Could not load topics from the server";
  }

  return (
    <TopicsClient initialTopics={initialTopics} topicsError={topicsError} />
  );
}
