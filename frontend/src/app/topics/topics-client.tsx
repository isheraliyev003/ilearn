"use client";

import type { TopicDto } from "@ilearn/shared";
import { API_PATHS, topicPath } from "@ilearn/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { apiFetch } from "@/lib/api";
import { fetchTopics, topicQueryKeys } from "@/lib/topic-queries";

type Props = {
  topicsError: string | null;
};

export function TopicsClient({ topicsError }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const topicsQuery = useQuery({
    queryKey: topicQueryKeys.all,
    queryFn: fetchTopics,
    retry: topicsError ? 0 : undefined,
  });

  const deleteTopic = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(topicPath(id), {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to delete topic");
      }
      return res.json() as Promise<{ ok: true }>;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: topicQueryKeys.all });
      const previousTopics = queryClient.getQueryData<TopicDto[]>(
        topicQueryKeys.all,
      );
      queryClient.setQueryData<TopicDto[]>(topicQueryKeys.all, (current = []) =>
        current.filter((topic) => topic.id !== id),
      );
      return { previousTopics };
    },
    onError: (_error, _id, context) => {
      if (context?.previousTopics) {
        queryClient.setQueryData(topicQueryKeys.all, context.previousTopics);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: topicQueryKeys.all });
    },
  });

  const createTopic = useMutation({
    mutationFn: async (t: string) => {
      const res = await apiFetch(API_PATHS.topics, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create topic");
      }
      return res.json() as Promise<TopicDto>;
    },
    onSuccess: (createdTopic) => {
      setTitle("");
      queryClient.setQueryData<TopicDto[]>(topicQueryKeys.all, (current = []) =>
        [createdTopic, ...current.filter((topic) => topic.id !== createdTopic.id)],
      );
    },
  });

  const topics = topicsQuery.data ?? [];
  const loadError =
    topicsError ??
    (topicsQuery.isError
      ? topicsQuery.error instanceof Error
        ? topicsQuery.error.message
        : "Could not load topics from the server"
      : null);
  const getLearnedPercent = (topic: TopicDto) =>
    topic.totalWords === 0
      ? 0
      : Math.round((topic.learnedWords / topic.totalWords) * 100);

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-300/90">
          ilearn
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Your topics
        </h1>
        <p className="max-w-lg text-slate-400">
          Create a topic, then add English words — we store English and Uzbek
          together.
        </p>
      </header>

      <form
        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-indigo-950/40 backdrop-blur-sm sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const t = title.trim();
          if (!t) return;
          createTopic.mutate(t);
        }}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <label
            htmlFor="topic-title"
            className="text-xs font-medium uppercase tracking-wide text-slate-400"
          >
            New topic
          </label>
          <input
            id="topic-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Business vocabulary"
            className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none ring-indigo-400/0 transition focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/30"
          />
        </div>
        <button
          type="submit"
          disabled={createTopic.isPending || !title.trim()}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {createTopic.isPending ? "Creating…" : "Create topic"}
        </button>
      </form>

      {(createTopic.isError || deleteTopic.isError) && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {(() => {
            const err = createTopic.error ?? deleteTopic.error;
            return err instanceof Error ? err.message : "Something went wrong";
          })()}
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-slate-200">All topics</h2>
        {loadError && (
          <p className="text-sm text-red-300">{loadError}</p>
        )}
        {!loadError && topicsQuery.isPending && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center">
            <p className="text-slate-400">Loading topics…</p>
          </div>
        )}
        {!loadError && topics.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center">
            <p className="text-slate-400">
              No topics yet. Name your first topic above to get started.
            </p>
          </div>
        )}
        {!loadError && topics.length > 0 && (
          <ul className="grid gap-3">
            {topics.map((topic) => (
              <li key={topic.id}>
                <div className="flex items-stretch rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] transition hover:border-indigo-400/40 hover:shadow-lg hover:shadow-indigo-950/50">
                  <Link
                    href={topicPath(topic.id)}
                    className="group flex min-w-0 flex-1 items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0 w-full">
                      <p className="truncate font-medium text-white group-hover:text-indigo-100">
                        {topic.title}
                      </p>
                      <div className="mt-1 space-y-2">
                        <p className="text-xs text-slate-500">
                          {new Date(topic.createdAt).toLocaleDateString(undefined, {
                            dateStyle: "medium",
                          })}
                        </p>
                        <div className="max-w-xs space-y-1">
                          <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-slate-400">
                            <span>Learned</span>
                            <span>
                              {topic.learnedWords}/{topic.totalWords}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-[width]"
                              style={{ width: `${getLearnedPercent(topic)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-indigo-300/80 transition group-hover:translate-x-0.5 group-hover:text-indigo-200"
                      aria-hidden
                    >
                      →
                    </span>
                  </Link>
                  <Link
                    href={`${topicPath(topic.id)}/quiz`}
                    className="shrink-0 border-l border-white/10 px-4 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/10 hover:text-emerald-100 flex items-center"
                  >
                    Quiz
                  </Link>
                  <button
                    type="button"
                    title="Delete topic"
                    disabled={deleteTopic.isPending}
                    onClick={() =>
                      setDeleteTarget({ id: topic.id, title: topic.title })
                    }
                    className="shrink-0 rounded-r-2xl border-l border-white/10 px-4 text-sm text-red-300/90 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete this topic?"
        description={
          deleteTarget
            ? `“${deleteTarget.title}” and all words in it will be permanently removed.`
            : undefined
        }
        confirmLabel="Delete topic"
        cancelLabel="Cancel"
        loading={deleteTopic.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          deleteTopic.mutate(id, {
            onSettled: () => setDeleteTarget(null),
          });
        }}
      />
    </div>
  );
}
