"use client";

import { topicQuizResultsPath } from "@ilearn/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { apiFetch } from "@/lib/api";
import { decodeHtmlEntities } from "@/lib/text";
import {
  clearQuizSession,
  initializeQuizSession,
  markQuizResultsSynced,
  type RootState,
  setQuizSelectedOption,
  submitQuizAnswer as submitPersistedQuizAnswer,
} from "@/lib/store";
import {
  fetchTopicQuiz,
  topicQueryKeys,
} from "@/lib/topic-queries";

type Props = {
  topicId: string;
};

const EMPTY_ANSWERS: Record<number, { selectedOption: string; isCorrect: boolean }> = {};

export function TopicQuizClient({ topicId }: Props) {
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const session = useSelector(
    (state: RootState) => state.quiz.sessions[topicId] ?? null,
  );
  const sessionQuizFingerprint = session?.quizFingerprint ?? "";
  const quizQuery = useQuery({
    queryKey: topicQueryKeys.quiz(topicId),
    queryFn: () => fetchTopicQuiz(topicId),
    retry: false,
  });

  useEffect(() => {
    if (!quizQuery.data || session) {
      return;
    }

    dispatch(
      initializeQuizSession({
        topicId,
        quiz: quizQuery.data,
      }),
    );
  }, [dispatch, quizQuery.data, session, topicId]);

  useEffect(() => {
    if (!quizQuery.data || !session) {
      return;
    }

    const sessionHasWordIds = session.quiz.questions.every(
      (quizQuestion) => typeof quizQuestion.wordId === "string" && quizQuestion.wordId.length > 0,
    );
    const serverHasWordIds = quizQuery.data.questions.every(
      (quizQuestion) => typeof quizQuestion.wordId === "string" && quizQuestion.wordId.length > 0,
    );

    if (sessionHasWordIds || !serverHasWordIds) {
      return;
    }

    dispatch(
      initializeQuizSession({
        topicId,
        quiz: quizQuery.data,
      }),
    );
  }, [dispatch, quizQuery.data, session, topicId]);

  const syncQuizResults = useMutation({
    mutationFn: async (results: Array<{ wordId: string; isCorrect: boolean }>) => {
      const res = await apiFetch(topicQuizResultsPath(topicId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save quiz results");
      }
      return res.json() as Promise<{ ok: true }>;
    },
    onSuccess: () => {
      dispatch(
        markQuizResultsSynced({
          topicId,
          quizFingerprint: sessionQuizFingerprint,
        }),
      );
      void queryClient.invalidateQueries({
        queryKey: topicQueryKeys.detail(topicId),
      });
      void queryClient.invalidateQueries({ queryKey: topicQueryKeys.all });
      void queryClient.invalidateQueries({
        queryKey: topicQueryKeys.wordsRoot(topicId),
      });
    },
  });

  const activeQuiz = session?.quiz ?? quizQuery.data ?? null;
  const currentIndex = session?.currentIndex ?? 0;
  const selectedOption = session?.selectedOption ?? null;
  const answers = session?.answers ?? EMPTY_ANSWERS;
  const resultsSynced = session?.resultsSynced ?? false;
  const question = activeQuiz?.questions[currentIndex] ?? null;
  const totalQuestions = activeQuiz?.totalQuestions ?? 0;
  const correctCount = Object.values(answers).filter(
    (answer) => answer.isCorrect,
  ).length;
  const isFinished = totalQuestions > 0 && currentIndex >= totalQuestions;

  const submitAnswer = () => {
    if (!question || !selectedOption) return;
    dispatch(submitPersistedQuizAnswer({ topicId }));
  };

  useEffect(() => {
    if (!question || isFinished || quizQuery.isPending || quizQuery.isError) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName.toLowerCase();
        if (tagName === "input" || tagName === "textarea") {
          return;
        }
      }

      const optionCount = question.options.length;
      const currentOptionIndex = selectedOption
        ? question.options.indexOf(selectedOption)
        : -1;

      if (event.key === "Enter") {
        if (!selectedOption) {
          return;
        }
        event.preventDefault();
        dispatch(submitPersistedQuizAnswer({ topicId }));
        return;
      }

      let nextIndex = -1;
      switch (event.key) {
        case "ArrowLeft":
          nextIndex =
            currentOptionIndex === -1
              ? 0
              : Math.max(currentOptionIndex - 1, 0);
          break;
        case "ArrowRight":
          nextIndex =
            currentOptionIndex === -1
              ? Math.min(1, optionCount - 1)
              : Math.min(currentOptionIndex + 1, optionCount - 1);
          break;
        case "ArrowUp":
          nextIndex =
            currentOptionIndex === -1
              ? 0
              : Math.max(currentOptionIndex - 2, 0);
          break;
        case "ArrowDown":
          nextIndex =
            currentOptionIndex === -1
              ? Math.min(2, optionCount - 1)
              : Math.min(currentOptionIndex + 2, optionCount - 1);
          break;
        default:
          return;
      }

      const nextOption = question.options[nextIndex];
      if (!nextOption) {
        return;
      }

      event.preventDefault();
      dispatch(
        setQuizSelectedOption({
          topicId,
          selectedOption: nextOption,
        }),
      );
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    dispatch,
    isFinished,
    question,
    quizQuery.isError,
    quizQuery.isPending,
    selectedOption,
    topicId,
  ]);

  useEffect(() => {
    if (!isFinished || !activeQuiz || resultsSynced || syncQuizResults.isPending) {
      return;
    }

    const results = activeQuiz.questions
      .map((quizQuestion, index) => {
        const answer = answers[index];
        if (!answer) {
          return null;
        }

        return {
          wordId: quizQuestion.wordId,
          isCorrect: answer.isCorrect,
        };
      })
      .filter(
        (result): result is { wordId: string; isCorrect: boolean } =>
          result != null &&
          typeof result.wordId === "string" &&
          result.wordId.length > 0,
      );

    if (results.length === 0) {
      return;
    }

    syncQuizResults.mutate(results);
  }, [activeQuiz, answers, isFinished, resultsSynced, syncQuizResults]);

  const startNewQuiz = async () => {
    dispatch(clearQuizSession({ topicId }));
    queryClient.removeQueries({ queryKey: topicQueryKeys.quiz(topicId) });

    try {
      const nextQuiz = await queryClient.fetchQuery({
        queryKey: topicQueryKeys.quiz(topicId),
        queryFn: () => fetchTopicQuiz(topicId),
        staleTime: 0,
      });

      dispatch(
        initializeQuizSession({
          topicId,
          quiz: nextQuiz,
        }),
      );
    } catch {
      // The existing quiz error UI will render from the query state.
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-300/90">
          Quiz
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {activeQuiz?.topicTitle ?? quizQuery.data?.topicTitle ?? "Topic quiz"}
        </h1>
        <p className="text-slate-400">
          Answer 10 randomized questions using words from this topic.
        </p>
      </header>

      {syncQuizResults.isError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {syncQuizResults.error instanceof Error
            ? syncQuizResults.error.message
            : "Could not save quiz results"}
        </p>
      )}

      {quizQuery.isError && (
        <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-red-100">
          <p className="text-lg font-semibold">Quiz unavailable</p>
          <p className="mt-2 text-sm">
            {quizQuery.error instanceof Error
              ? quizQuery.error.message
              : "Could not load quiz"}
          </p>
          <p className="mt-3 text-sm text-red-200/80">
            You need at least 4 not-yet-learned words in this topic to generate 4 answer options.
          </p>
        </div>
      )}

      {quizQuery.isPending && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-400">
          Preparing your quiz…
        </div>
      )}

      {!quizQuery.isPending && !quizQuery.isError && isFinished && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-xl shadow-indigo-950/30">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300/90">
              Finished
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">
              {correctCount} / {totalQuestions}
            </h2>
            <p className="mt-3 text-slate-400">
              You answered {correctCount} out of {totalQuestions} questions correctly.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void startNewQuiz()}
                className="rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
              >
                Start new quiz
              </button>
              <Link
                href={`/topics/${topicId}`}
                className="rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Back to topic
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-indigo-950/20">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-semibold text-white">Answer review</h3>
              <p className="text-sm text-slate-400">
                See which answers were correct and which were not.
              </p>
            </div>

            <div className="mt-6 grid gap-4">
              {activeQuiz?.questions.map((reviewQuestion, index) => {
                const answer = answers[index];
                const wasCorrect = answer?.isCorrect ?? false;

                return (
                  <div
                    key={reviewQuestion.id}
                    className={`rounded-2xl border p-5 ${
                      wasCorrect
                        ? "border-emerald-400/30 bg-emerald-500/10"
                        : "border-red-400/25 bg-red-500/10"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                          Question {index + 1}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {reviewQuestion.englishTerm}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                          wasCorrect
                            ? "bg-emerald-400/20 text-emerald-100"
                            : "bg-red-400/20 text-red-100"
                        }`}
                      >
                        {wasCorrect ? "Correct" : "Wrong"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                          Your answer
                        </p>
                        <p className="mt-2 text-sm font-medium text-white">
                          {answer?.selectedOption
                            ? decodeHtmlEntities(answer.selectedOption)
                            : "No answer selected"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                          Correct answer
                        </p>
                        <p className="mt-2 text-sm font-medium text-emerald-200">
                          {decodeHtmlEntities(reviewQuestion.correctAnswer)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!quizQuery.isPending && !quizQuery.isError && !isFinished && question && (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <p className="text-sm font-medium text-slate-300">
              Question {currentIndex + 1} / {totalQuestions}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.03] p-6 shadow-xl shadow-indigo-950/20">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              English word
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-white">
              {question.englishTerm}
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              Choose the correct Uzbek translation.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {question.options.map((option) => {
                const isActive = selectedOption === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      dispatch(
                        setQuizSelectedOption({
                          topicId,
                          selectedOption: option,
                        }),
                      )
                    }
                    className={`rounded-2xl border px-5 py-4 text-left text-sm font-medium transition ${
                      isActive
                        ? "border-indigo-400/50 bg-indigo-500/10 text-white"
                        : "border-white/10 bg-slate-950/50 text-slate-200 hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    {decodeHtmlEntities(option)}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => void startNewQuiz()}
                className="rounded-xl border border-white/10 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              >
                Start new quiz
              </button>
              <button
                type="button"
                onClick={submitAnswer}
                disabled={!selectedOption}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next question
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
