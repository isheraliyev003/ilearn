import type { PaginatedWordsResponse, TopicDto } from "@ilearn/shared";
import {
  API_PATHS,
  joinApiUrl,
  topicPath,
  wordsListQuery,
} from "@ilearn/shared";

function getServerApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export async function fetchTopicsServer(): Promise<TopicDto[]> {
  const res = await fetch(joinApiUrl(getServerApiBase(), API_PATHS.topics), {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Could not load topics");
  }
  return res.json() as Promise<TopicDto[]>;
}

export async function fetchTopicServer(
  topicId: string,
): Promise<TopicDto | null> {
  const res = await fetch(joinApiUrl(getServerApiBase(), topicPath(topicId)), {
    cache: "no-store",
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error("Could not load topic");
  }
  return res.json() as Promise<TopicDto>;
}

const WORDS_PAGE_SIZE = 20;

export async function fetchWordsFirstPageServer(
  topicId: string,
): Promise<PaginatedWordsResponse> {
  const path = wordsListQuery({ topicId, limit: WORDS_PAGE_SIZE });
  const res = await fetch(joinApiUrl(getServerApiBase(), path), {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Could not load words");
  }
  return res.json() as Promise<PaginatedWordsResponse>;
}
