/** Shared API types aligned with Nest responses. */

export type UserDto = {
  id: string;
  fullName: string;
  email: string;
};

export type TopicDto = {
  id: string;
  title: string;
  totalWords: number;
  learnedWords: number;
  createdAt: string;
  updatedAt: string;
};

export type WordEntryDto = {
  id: string;
  topicId: string;
  englishTerm: string;
  uzbekTranslation: string;
  isLearned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PaginatedWordsResponse = {
  items: WordEntryDto[];
  nextCursor: string | null;
};

export type QuizQuestionDto = {
  id: string;
  wordId: string;
  englishTerm: string;
  options: string[];
  correctAnswer: string;
};

export type TopicQuizDto = {
  topicId: string;
  topicTitle: string;
  totalQuestions: number;
  questions: QuizQuestionDto[];
};

export type AuthUserResponse = {
  user: UserDto | null;
};

export type QuizResultItemDto = {
  wordId: string;
  isCorrect: boolean;
};

export const API_PATHS = {
  authMe: '/auth/me',
  authSignUpRequestCode: '/auth/sign-up/request-code',
  authSignUpVerifyCode: '/auth/sign-up/verify-code',
  authSignUpComplete: '/auth/sign-up/complete',
  authSignIn: '/auth/sign-in',
  authLogout: '/auth/logout',
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

export function topicQuizPath(topicId: string): string {
  return `${API_PATHS.topics}/${encodeURIComponent(topicId)}/quiz`;
}

export function topicQuizResultsPath(topicId: string): string {
  return `${topicQuizPath(topicId)}/results`;
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
