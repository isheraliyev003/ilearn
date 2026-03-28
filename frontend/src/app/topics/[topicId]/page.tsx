import { notFound } from "next/navigation";
import type { PaginatedWordsResponse } from "@ilearn/shared";
import { TopicWordsClient } from "./topic-words-client";
import { fetchTopicServer, fetchWordsFirstPageServer } from "@/lib/server-api";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const topic = await fetchTopicServer(topicId);
  if (!topic) {
    notFound();
  }

  let initialWordsPage: PaginatedWordsResponse;
  try {
    initialWordsPage = await fetchWordsFirstPageServer(topicId);
  } catch {
    initialWordsPage = { items: [], nextCursor: null };
  }

  return (
    <TopicWordsClient
      topicId={topicId}
      initialTopic={topic}
      initialWordsPage={initialWordsPage}
    />
  );
}
