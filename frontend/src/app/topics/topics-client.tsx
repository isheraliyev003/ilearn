"use client";

import type { TopicDto } from "@ilearn/shared";
import { API_PATHS, joinApiUrl, topicPath } from "@ilearn/shared";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/api";

type Props = {
  initialTopics: TopicDto[];
  topicsError: string | null;
};

export function TopicsClient({ initialTopics, topicsError }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [topics, setTopics] = useState(initialTopics);

  useEffect(() => {
    setTopics(initialTopics);
  }, [initialTopics]);

  const deleteTopic = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(joinApiUrl(getApiBase(), topicPath(id)), {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to delete topic");
      }
      return res.json() as Promise<{ ok: true }>;
    },
    onSuccess: () => {
      void router.refresh();
    },
  });

  const createTopic = useMutation({
    mutationFn: async (t: string) => {
      const res = await fetch(joinApiUrl(getApiBase(), API_PATHS.topics), {
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
    onSuccess: () => {
      setTitle("");
      void router.refresh();
    },
  });

  const loadError = topicsError;

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6">
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
                <div className="flex items-stretch gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] transition hover:border-indigo-400/40 hover:shadow-lg hover:shadow-indigo-950/50">
                  <Link
                    href={topicPath(topic.id)}
                    className="group flex min-w-0 flex-1 items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white group-hover:text-indigo-100">
                        {topic.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(topic.createdAt).toLocaleDateString(undefined, {
                          dateStyle: "medium",
                        })}
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-indigo-300/80 transition group-hover:translate-x-0.5 group-hover:text-indigo-200"
                      aria-hidden
                    >
                      →
                    </span>
                  </Link>
                  <button
                    type="button"
                    title="Delete topic"
                    disabled={deleteTopic.isPending}
                    onClick={() => deleteTopic.mutate(topic.id)}
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
    </div>
  );
}
