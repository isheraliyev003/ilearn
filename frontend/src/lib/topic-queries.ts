import type { InfiniteData } from "@tanstack/react-query";
import type {
  AuthUserResponse,
  PaginatedWordsResponse,
  TopicQuizDto,
  TopicDto,
  UserDto,
  WordEntryDto,
} from "@ilearn/shared";
import { API_PATHS, topicPath, topicQuizPath, wordsListQuery } from "@ilearn/shared";
import { apiFetch } from "./api";

const PAGE_SIZE = 20;

export const topicQueryKeys = {
  currentUser: ["auth", "me"] as const,
  all: ["topics"] as const,
  detail: (topicId: string) => ["topics", topicId] as const,
  quiz: (topicId: string) => ["topics", topicId, "quiz"] as const,
  wordsRoot: (topicId: string) => ["words", topicId] as const,
  words: (topicId: string, search: string) =>
    ["words", topicId, search] as const,
};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Request failed");
  }
  return res.json() as Promise<T>;
}

export async function fetchTopics(): Promise<TopicDto[]> {
  const res = await apiFetch(API_PATHS.topics, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Could not load topics");
  }
  return res.json() as Promise<TopicDto[]>;
}

export async function fetchTopic(topicId: string): Promise<TopicDto> {
  const res = await fetchJson<TopicDto>(topicPath(topicId));
  return res;
}

export async function fetchTopicQuiz(topicId: string): Promise<TopicQuizDto> {
  const res = await fetchJson<TopicQuizDto>(topicQuizPath(topicId));
  return res;
}

export async function fetchCurrentUser(): Promise<UserDto | null> {
  const res = await apiFetch(API_PATHS.authMe, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Could not load current user");
  }
  const body = (await res.json()) as AuthUserResponse;
  return body.user;
}

export async function fetchWordsPage(params: {
  topicId: string;
  search?: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedWordsResponse> {
  const path = wordsListQuery({
    topicId: params.topicId,
    q: params.search || undefined,
    cursor: params.cursor,
    limit: params.limit ?? PAGE_SIZE,
  });
  const res = await apiFetch(path, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Could not load words");
  }
  return res.json() as Promise<PaginatedWordsResponse>;
}

export function flattenWordPages(
  data: InfiniteData<PaginatedWordsResponse, unknown> | undefined,
): WordEntryDto[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

export const wordsPageSize = PAGE_SIZE;
