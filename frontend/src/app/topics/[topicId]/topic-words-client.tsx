"use client";

import type {
  PaginatedWordsResponse,
  TopicDto,
  WordEntryDto,
} from "@ilearn/shared";
import {
  topicPath,
  topicsWordsPath,
  wordPath,
} from "@ilearn/shared";
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { readErrorMessage } from "@/lib/errors";
import { decodeHtmlEntities } from "@/lib/text";
import {
  fetchTopic,
  fetchWordsPage,
  flattenWordPages,
  topicQueryKeys,
  wordsPageSize,
} from "@/lib/topic-queries";

type Props = {
  topicId: string;
};

export function TopicWordsClient({ topicId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [english, setEnglish] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editingWordId, setEditingWordId] = useState<string | null>(null);
  const [editingTranslation, setEditingTranslation] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const topicQuery = useQuery({
    queryKey: topicQueryKeys.detail(topicId),
    queryFn: () => fetchTopic(topicId),
  });

  const wordsQuery = useInfiniteQuery<
    PaginatedWordsResponse,
    Error,
    InfiniteData<PaginatedWordsResponse>,
    ReturnType<typeof topicQueryKeys.words>,
    string | undefined
  >({
    queryKey: topicQueryKeys.words(topicId, debouncedSearch),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      return fetchWordsPage({
        topicId,
        search: debouncedSearch || undefined,
        cursor: pageParam,
        limit: wordsPageSize,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const flatWords = flattenWordPages(wordsQuery.data);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = wordsQuery;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "240px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const deleteTopic = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(topicPath(topicId), {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to delete topic"));
      }
      return res.json() as Promise<{ ok: true }>;
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: topicQueryKeys.wordsRoot(topicId) });
      void qc.removeQueries({ queryKey: topicQueryKeys.detail(topicId) });
      qc.setQueryData<TopicDto[]>(
        topicQueryKeys.all,
        (current = []) => current.filter((topic) => topic.id !== topicId),
      );
      router.push("/topics");
    },
  });

  const deleteWord = useMutation({
    mutationFn: async (wordId: string) => {
      const res = await apiFetch(wordPath(wordId), {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to delete word"));
      }
      return res.json() as Promise<{ ok: true }>;
    },
    onSuccess: (_result, wordId) => {
      const removedWord = flatWords.find((word) => word.id === wordId);
      qc.setQueriesData<InfiniteData<PaginatedWordsResponse>>(
        { queryKey: topicQueryKeys.wordsRoot(topicId) },
        (current) => {
          if (!current) return current;
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.filter((word) => word.id !== wordId),
            })),
          };
        },
      );
      qc.setQueryData<TopicDto | undefined>(topicQueryKeys.detail(topicId), (current) =>
        current
          ? {
              ...current,
              totalWords: Math.max(0, current.totalWords - 1),
              learnedWords: Math.max(
                0,
                current.learnedWords - (removedWord?.isLearned ? 1 : 0),
              ),
            }
          : current,
      );
      qc.setQueryData<TopicDto[] | undefined>(topicQueryKeys.all, (current) =>
        current?.map((topic) =>
          topic.id === topicId
            ? {
                ...topic,
                totalWords: Math.max(0, topic.totalWords - 1),
                learnedWords: Math.max(
                  0,
                  topic.learnedWords - (removedWord?.isLearned ? 1 : 0),
                ),
              }
            : topic,
        ),
      );
    },
  });

  const addWord = useMutation({
    mutationFn: async (term: string) => {
      const res = await apiFetch(topicsWordsPath(topicId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ englishTerm: term }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to add word"));
      }
      return res.json() as Promise<WordEntryDto>;
    },
    onSuccess: (createdWord) => {
      qc.setQueryData<InfiniteData<PaginatedWordsResponse>>(
        topicQueryKeys.words(topicId, ""),
        (current) => {
          if (!current) {
            return {
              pages: [{ items: [createdWord], nextCursor: null }],
              pageParams: [undefined],
            };
          }

          const [firstPage, ...restPages] = current.pages;
          if (!firstPage) {
            return current;
          }

          return {
            ...current,
            pages: [
              {
                ...firstPage,
                items: [createdWord, ...firstPage.items.filter((word) => word.id !== createdWord.id)],
              },
              ...restPages,
            ],
          };
        },
      );
      qc.setQueryData<TopicDto | undefined>(topicQueryKeys.detail(topicId), (current) =>
        current
          ? {
              ...current,
              totalWords: current.totalWords + 1,
            }
          : current,
      );
      qc.setQueryData<TopicDto[] | undefined>(topicQueryKeys.all, (current) =>
        current?.map((topic) =>
          topic.id === topicId
            ? {
                ...topic,
                totalWords: topic.totalWords + 1,
              }
            : topic,
        ),
      );
      void qc.invalidateQueries({
        queryKey: topicQueryKeys.wordsRoot(topicId),
        exact: false,
      });
      setEnglish("");
    },
  });

  const editWord = useMutation({
    mutationFn: async ({
      wordId,
      uzbekTranslation,
    }: {
      wordId: string;
      uzbekTranslation: string;
    }) => {
      const res = await apiFetch(wordPath(wordId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uzbekTranslation }),
      });
      if (!res.ok) {
        throw new Error(
          await readErrorMessage(res, "Failed to update translation"),
        );
      }
      return res.json() as Promise<WordEntryDto>;
    },
    onSuccess: (updatedWord) => {
      qc.setQueriesData<InfiniteData<PaginatedWordsResponse>>(
        { queryKey: topicQueryKeys.wordsRoot(topicId) },
        (current) => {
          if (!current) return current;
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.map((word) =>
                word.id === updatedWord.id ? updatedWord : word,
              ),
            })),
          };
        },
      );
      setEditingWordId(null);
      setEditingTranslation("");
    },
  });

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {topicQuery.data?.title ?? "Loading topic…"}
          </h1>
          <p className="text-slate-400">
            Add an English word or phrase. We translate it to Uzbek and save
            both.
          </p>
          {topicQuery.data && (
            <div className="max-w-sm space-y-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                <span>Learned progress</span>
                <span>
                  {topicQuery.data.learnedWords}/{topicQuery.data.totalWords}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width]"
                  style={{
                    width: `${
                      topicQuery.data.totalWords === 0
                        ? 0
                        : Math.round(
                            (topicQuery.data.learnedWords /
                              topicQuery.data.totalWords) *
                              100,
                          )
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href={`/topics/${topicId}/quiz`}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/20"
          >
            Quiz
          </Link>
          <button
            type="button"
            disabled={deleteTopic.isPending}
            onClick={() => deleteTopic.mutate()}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-40"
          >
            {deleteTopic.isPending ? "Deleting…" : "Delete topic"}
          </button>
        </div>
      </header>

      <form
        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-indigo-950/40 backdrop-blur-sm lg:flex-row lg:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const t = english.trim();
          if (!t) return;
          addWord.mutate(t);
        }}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <label
            htmlFor="english-term"
            className="text-xs font-medium uppercase tracking-wide text-slate-400"
          >
            English word or expression
          </label>
          <input
            id="english-term"
            value={english}
            onChange={(e) => setEnglish(e.target.value)}
            placeholder="e.g. carry out"
            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/30"
          />
        </div>
        <button
          type="submit"
          disabled={addWord.isPending || !english.trim()}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {addWord.isPending ? "Translating…" : "Add word"}
        </button>
      </form>

      {deleteTopic.isError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {deleteTopic.error instanceof Error
            ? deleteTopic.error.message
            : "Could not delete topic"}
        </p>
      )}

      {addWord.isError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {addWord.error instanceof Error
            ? addWord.error.message
            : "Could not add word"}
        </p>
      )}

      {editWord.isError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {editWord.error instanceof Error
            ? editWord.error.message
            : "Could not update translation"}
        </p>
      )}

      {deleteWord.isError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {deleteWord.error instanceof Error
            ? deleteWord.error.message
            : "Could not delete word"}
        </p>
      )}

      {topicQuery.isError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {topicQuery.error instanceof Error
            ? topicQuery.error.message
            : "Could not load topic"}
        </p>
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium text-slate-200">Words</h2>
          <div className="relative max-w-md flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-3xl leading-none text-slate-500">
              ⌕
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search English or Uzbek…"
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-2.5 pr-4 pl-10 text-sm text-white placeholder:text-slate-500 outline-none focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-400/20"
            />
          </div>
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-inner md:block">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">English</th>
                <th className="px-4 py-3 font-medium">Uzbek</th>
                <th className="px-4 py-3 font-medium">Added</th>
                <th className="w-24 px-4 py-3 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {wordsQuery.isPending && debouncedSearch !== "" && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                    Loading words…
                  </td>
                </tr>
              )}
              {wordsQuery.isError && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-red-300">
                    {wordsQuery.error instanceof Error
                      ? wordsQuery.error.message
                      : "Failed to load"}
                  </td>
                </tr>
              )}
              {!wordsQuery.isPending &&
                flatWords.length === 0 &&
                !wordsQuery.isError && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-14 text-center text-slate-500"
                    >
                      {debouncedSearch
                        ? "No matches for this search."
                        : "No words in this topic yet."}
                    </td>
                  </tr>
                )}
              {flatWords.map((w) => (
                <tr
                  key={w.id}
                  className={`border-b border-white/5 transition ${
                    w.isLearned
                      ? "bg-emerald-500/[0.06]"
                      : "hover:bg-white/[0.04]"
                  }`}
                >
                  <td className="max-w-[200px] px-4 py-3 font-medium text-white">
                    {w.englishTerm}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {editingWordId === w.id ? (
                      <input
                        value={editingTranslation}
                        onChange={(e) => setEditingTranslation(e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-400/20"
                      />
                    ) : (
                      decodeHtmlEntities(w.uzbekTranslation)
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                    {new Date(w.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {editingWordId === w.id ? (
                        <>
                          <button
                            type="button"
                            disabled={editWord.isPending || !editingTranslation.trim()}
                            onClick={() =>
                              editWord.mutate({
                                wordId: w.id,
                                uzbekTranslation: editingTranslation,
                              })
                            }
                            className="rounded-lg px-2 py-1 text-xs text-emerald-200 transition hover:bg-emerald-500/15 disabled:opacity-40"
                          >
                            {editWord.isPending ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWordId(null);
                              setEditingTranslation("");
                            }}
                            className="rounded-lg px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingWordId(w.id);
                              setEditingTranslation(decodeHtmlEntities(w.uzbekTranslation));
                            }}
                            className="rounded-lg px-2 py-1 text-xs text-indigo-200 transition hover:bg-indigo-500/15"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            title="Delete word"
                            disabled={deleteWord.isPending}
                            onClick={() => deleteWord.mutate(w.id)}
                            className="rounded-lg px-2 py-1 text-xs text-red-300/90 transition hover:bg-red-500/15 hover:text-red-200"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="grid gap-3 md:hidden">
          {wordsQuery.isPending && debouncedSearch !== "" && (
            <li className="rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-500">
              Loading…
            </li>
          )}
          {flatWords.map((w) => (
            <li
              key={w.id}
              className={`space-y-2 rounded-2xl border border-white/10 p-4 ${
                w.isLearned
                  ? "bg-gradient-to-br from-emerald-500/[0.12] to-transparent"
                  : "bg-gradient-to-br from-white/[0.06] to-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-lg font-semibold text-white">{w.englishTerm}</p>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-slate-500">
                    {new Date(w.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    disabled={deleteWord.isPending}
                    onClick={() => deleteWord.mutate(w.id)}
                    className="text-xs text-red-300/90 hover:text-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-200">
                {editingWordId === w.id ? (
                  <input
                    value={editingTranslation}
                    onChange={(e) => setEditingTranslation(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-400/20"
                  />
                ) : (
                  decodeHtmlEntities(w.uzbekTranslation)
                )}
              </p>
              <div className="flex justify-end gap-2">
                {editingWordId === w.id ? (
                  <>
                    <button
                      type="button"
                      disabled={editWord.isPending || !editingTranslation.trim()}
                      onClick={() =>
                        editWord.mutate({
                          wordId: w.id,
                          uzbekTranslation: editingTranslation,
                        })
                      }
                      className="rounded-lg px-2 py-1 text-xs text-emerald-200 transition hover:bg-emerald-500/15 disabled:opacity-40"
                    >
                      {editWord.isPending ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWordId(null);
                        setEditingTranslation("");
                      }}
                      className="rounded-lg px-2 py-1 text-xs text-slate-300 transition hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWordId(w.id);
                      setEditingTranslation(decodeHtmlEntities(w.uzbekTranslation));
                    }}
                    className="rounded-lg px-2 py-1 text-xs text-indigo-200 transition hover:bg-indigo-500/15"
                  >
                    Edit translation
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div ref={sentinelRef} className="h-4 w-full" aria-hidden />
        {wordsQuery.isFetchingNextPage && (
          <p className="text-center text-sm text-slate-500">Loading more…</p>
        )}
      </div>
    </div>
  );
}
