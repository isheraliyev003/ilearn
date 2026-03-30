import { notFound } from "next/navigation";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { TopicQuizClient } from "./topic-quiz-client";
import {
  fetchTopicQuizServer,
  fetchTopicServer,
} from "@/lib/server-api";
import { topicQueryKeys } from "@/lib/topic-queries";

export const dynamic = "force-dynamic";

export default async function TopicQuizPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const queryClient = new QueryClient();
  const { topicId } = await params;

  const topic = await fetchTopicServer(topicId);
  if (!topic) {
    notFound();
  }

  queryClient.setQueryData(topicQueryKeys.detail(topicId), topic);

  try {
    const quiz = await fetchTopicQuizServer(topicId);
    queryClient.setQueryData(topicQueryKeys.quiz(topicId), quiz);
  } catch {
    // Let the client render the quiz error state.
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TopicQuizClient topicId={topicId} />
    </HydrationBoundary>
  );
}
