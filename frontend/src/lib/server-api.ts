import type {
  AuthUserResponse,
  PaginatedWordsResponse,
  TopicQuizDto,
  TopicDto,
} from "@ilearn/shared";
import {
  API_PATHS,
  joinApiUrl,
  topicPath,
  topicQuizPath,
  wordsListQuery,
} from "@ilearn/shared";
import { cookies } from "next/headers";

const SERVER_FETCH_RETRY_DELAYS_MS = [150, 300, 500] as const;

function getServerApiBase(): string {
  const configured =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:3001";

  // In local SSR, Node can resolve localhost to an unavailable interface.
  return configured.replace("://localhost", "://127.0.0.1");
}

function isRetryableServerFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const cause = error.cause;
  if (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: string }).code === "ECONNREFUSED"
  ) {
    return true;
  }

  return error.message.toLowerCase().includes("fetch failed");
}

async function serverFetch(path: string, init?: RequestInit): Promise<Response> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const url = joinApiUrl(getServerApiBase(), path);
  const requestInit: RequestInit = {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  };

  for (let attempt = 0; attempt <= SERVER_FETCH_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await fetch(url, requestInit);
    } catch (error) {
      if (
        attempt === SERVER_FETCH_RETRY_DELAYS_MS.length ||
        !isRetryableServerFetchError(error)
      ) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, SERVER_FETCH_RETRY_DELAYS_MS[attempt]),
      );
    }
  }

  throw new Error("Unreachable server fetch state");
}

export async function fetchCurrentUserServer() {
  const res = await serverFetch(API_PATHS.authMe);
  if (!res.ok) {
    throw new Error("Could not load current user");
  }
  const body = (await res.json()) as AuthUserResponse;
  return body.user;
}

export async function fetchTopicsServer(): Promise<TopicDto[]> {
  const res = await serverFetch(API_PATHS.topics);
  if (!res.ok) {
    throw new Error("Could not load topics");
  }
  return res.json() as Promise<TopicDto[]>;
}

export async function fetchTopicServer(
  topicId: string,
): Promise<TopicDto | null> {
  const res = await serverFetch(topicPath(topicId));
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error("Could not load topic");
  }
  return res.json() as Promise<TopicDto>;
}

export async function fetchTopicQuizServer(
  topicId: string,
): Promise<TopicQuizDto> {
  const res = await serverFetch(topicQuizPath(topicId));
  if (!res.ok) {
    throw new Error("Could not load quiz");
  }
  return res.json() as Promise<TopicQuizDto>;
}

const WORDS_PAGE_SIZE = 20;

export async function fetchWordsPageServer(params: {
  topicId: string;
  q?: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedWordsResponse> {
  const path = wordsListQuery({
    topicId: params.topicId,
    q: params.q,
    cursor: params.cursor,
    limit: params.limit ?? WORDS_PAGE_SIZE,
  });
  const res = await serverFetch(path);
  if (!res.ok) {
    throw new Error("Could not load words");
  }
  return res.json() as Promise<PaginatedWordsResponse>;
}

export async function fetchWordsFirstPageServer(
  topicId: string,
): Promise<PaginatedWordsResponse> {
  return fetchWordsPageServer({ topicId, limit: WORDS_PAGE_SIZE });
}
