/** Shared API types aligned with Nest responses. */

export type TopicDto = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type WordEntryDto = {
  id: string;
  topicId: string;
  englishTerm: string;
  uzbekTranslation: string;
  createdAt: string;
  updatedAt: string;
};

export type PaginatedWordsResponse = {
  items: WordEntryDto[];
  nextCursor: string | null;
};

export const API_PATHS = {
  health: '/health',
  topics: '/topics',
  words: '/words',
} as const;

export function joinApiUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export function topicPath(topicId: string): string {
  return `${API_PATHS.topics}/${encodeURIComponent(topicId)}`;
}

export function topicsWordsPath(topicId: string): string {
  return `${API_PATHS.topics}/${encodeURIComponent(topicId)}/words`;
}

export function wordPath(wordId: string): string {
  return `${API_PATHS.words}/${encodeURIComponent(wordId)}`;
}

export function wordsListQuery(params: {
  topicId: string;
  q?: string;
  cursor?: string;
  limit?: number;
}): string {
  const search = new URLSearchParams();
  search.set('topicId', params.topicId);
  if (params.q?.trim()) {
    search.set('q', params.q.trim());
  }
  if (params.cursor) {
    search.set('cursor', params.cursor);
  }
  if (params.limit != null) {
    search.set('limit', String(params.limit));
  }
  const qs = search.toString();
  return qs ? `${API_PATHS.words}?${qs}` : API_PATHS.words;
}
