"use client";

import { API_PATHS } from "@ilearn/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { fetchCurrentUser, topicQueryKeys } from "@/lib/topic-queries";

type AuthMode = "sign-up" | "sign-in";
type SignUpStep = "request-code" | "verify-code" | "set-password";

const signUpSteps: Array<{
  id: SignUpStep;
  label: string;
  title: string;
  description: string;
}> = [
  {
    id: "request-code",
    label: "Step 1",
    title: "Who are you?",
    description: "Enter your full name and email so we can send your sign-up code.",
  },
  {
    id: "verify-code",
    label: "Step 2",
    title: "Verify your email",
    description: "Enter the 6-digit code we sent before you choose a password.",
  },
  {
    id: "set-password",
    label: "Step 3",
    title: "Create your password",
    description: "Set your password to finish creating the account.",
  },
];

const studentBenefits = [
  {
    eyebrow: "Remember faster",
    title: "Turn every topic into active practice",
    description:
      "Save words from your lessons, then revisit them through focused quizzes until they actually stick.",
  },
  {
    eyebrow: "Study with structure",
    title: "Keep school vocabulary organized by topic",
    description:
      "Separate units like travel, biology, business, or literature so revision feels clear instead of messy.",
  },
  {
    eyebrow: "See real progress",
    title: "Track what is still new and what is already learned",
    description:
      "Your account keeps your vocabulary, quiz progress, and learned words together in one private place.",
  },
];

const studentOutcomes = [
  "Build topic-based English vocabulary lists",
  "Get Uzbek translations saved instantly",
  "Practice only the words you still need",
  "Keep your progress private on your own account",
];

export default function AuthPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AuthMode>("sign-up");
  const [signUpStep, setSignUpStep] = useState<SignUpStep>("request-code");
  const [fullName, setFullName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const currentUserQuery = useQuery({
    queryKey: topicQueryKeys.currentUser,
    queryFn: fetchCurrentUser,
  });

  useEffect(() => {
    if (currentUserQuery.data) {
      router.replace("/topics");
    }
  }, [currentUserQuery.data, router]);

  const requestCode = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(API_PATHS.authSignUpRequestCode, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: signUpEmail.trim(),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to send sign-up code");
      }
    },
    onSuccess: () => {
      setSignUpStep("verify-code");
    },
  });

  const verifyCode = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(API_PATHS.authSignUpVerifyCode, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signUpEmail.trim(),
          code: code.trim(),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to verify sign-up code");
      }
    },
    onSuccess: () => {
      setSignUpStep("set-password");
    },
  });

  const completeSignUp = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(API_PATHS.authSignUpComplete, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signUpEmail.trim(),
          code: code.trim(),
          password,
          confirmPassword,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to complete sign up");
      }
      return res.json() as Promise<{
        user: { id: string; fullName: string; email: string };
      }>;
    },
    onSuccess: async ({ user }) => {
      queryClient.setQueryData(topicQueryKeys.currentUser, user);
      await queryClient.invalidateQueries({ queryKey: topicQueryKeys.currentUser });
      router.replace("/topics");
    },
  });

  const signIn = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(API_PATHS.authSignIn, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signInEmail.trim(),
          password: signInPassword,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to sign in");
      }
      return res.json() as Promise<{
        user: { id: string; fullName: string; email: string };
      }>;
    },
    onSuccess: async ({ user }) => {
      queryClient.setQueryData(topicQueryKeys.currentUser, user);
      await queryClient.invalidateQueries({ queryKey: topicQueryKeys.currentUser });
      router.replace("/topics");
    },
  });

  const error =
    mode === "sign-up"
      ? requestCode.error ?? verifyCode.error ?? completeSignUp.error
      : signIn.error;

  const isBusy =
    requestCode.isPending ||
    verifyCode.isPending ||
    completeSignUp.isPending ||
    signIn.isPending;

  const currentStepIndex = signUpSteps.findIndex((step) => step.id === signUpStep);
  const currentStep = signUpSteps[currentStepIndex] ?? signUpSteps[0];

  return (
    <div className="box-border flex h-[100dvh] w-full flex-col overflow-hidden p-2 sm:p-3">
      <div className="grid h-full items-stretch gap-3 lg:grid-cols-[1.32fr_0.82fr] lg:gap-3">
        <section className="flex h-full flex-col overflow-auto rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_30%),linear-gradient(160deg,rgba(15,23,42,0.92),rgba(3,7,18,0.92))] p-4 shadow-2xl shadow-slate-950/40 backdrop-blur-sm sm:p-5">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-indigo-300/90">
            ilearn
          </p>
          <div className="mt-3 inline-flex w-fit max-w-full items-center gap-2 self-start rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-100">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Built for students who want stronger English vocabulary
          </div>
          <h1 className="mt-3 max-w-2xl text-[2rem] font-semibold tracking-tight text-white sm:text-[2.35rem] xl:text-[2.6rem]">
            Study vocabulary with less chaos and more confidence.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            `ilearn` helps students collect English words by topic, keep Uzbek
            translations in one place, and practice until difficult words become
            familiar.
          </p>

          <div className="mt-4 grid items-start gap-2.5 sm:grid-cols-3">
            <div className="self-start rounded-2xl border border-white/10 bg-white/[0.05] p-3.5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                Personal topics
              </p>
              <p className="mt-1 text-lg font-semibold text-white">Private</p>
              <p className="mt-1 text-xs leading-5 text-slate-300 sm:text-sm">
                Your vocabulary stays tied to your own account.
              </p>
            </div>
            <div className="self-start rounded-2xl border border-white/10 bg-white/[0.05] p-3.5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                Quiz practice
              </p>
              <p className="mt-1 text-lg font-semibold text-white">Focused</p>
              <p className="mt-1 text-xs leading-5 text-slate-300 sm:text-sm">
                Review only the words you have not mastered yet.
              </p>
            </div>
            <div className="self-start rounded-2xl border border-white/10 bg-white/[0.05] p-3.5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                Learning flow
              </p>
              <p className="mt-1 text-lg font-semibold text-white">Simple</p>
              <p className="mt-1 text-xs leading-5 text-slate-300 sm:text-sm">
                Save, revise, quiz, and improve from one screen.
              </p>
            </div>
          </div>

          <div className="mt-4 grid items-start gap-2.5 xl:grid-cols-[1.04fr_0.96fr]">
            <div className="self-start rounded-3xl border border-white/10 bg-slate-950/45 p-3.5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-indigo-300/90">
                What Students Get
              </p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-3 xl:grid-cols-1">
                {studentBenefits.map((benefit) => (
                  <div
                    key={benefit.title}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-3"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                      {benefit.eyebrow}
                    </p>
                    <h2 className="mt-1 text-sm font-semibold text-white sm:text-base">
                      {benefit.title}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-slate-300 sm:text-sm">
                      {benefit.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="self-start rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.9))] p-3.5">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300/90">
                Why It Helps
              </p>
              <div className="mt-3 space-y-2">
                {studentOutcomes.map((outcome) => (
                  <div
                    key={outcome}
                    className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-2.5"
                  >
                    <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-[11px] font-bold text-emerald-200">
                      ✓
                    </span>
                    <p className="text-xs leading-5 text-slate-200 sm:text-sm">{outcome}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-200/90">
                  Best for
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-200 sm:text-sm">
                  School vocabulary, exam preparation, self-study, and topic-based
                  revision after class.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex h-full flex-col overflow-auto rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(30,41,59,0.72),rgba(15,23,42,0.78))] p-4 shadow-2xl shadow-slate-950/30 backdrop-blur-sm sm:p-5">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-indigo-300/90">
          ilearn
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {mode === "sign-up" ? "Create your account" : "Sign in"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {mode === "sign-up"
            ? "Create your private study space. Start with your full name and email, verify your code, then choose a password."
            : "Return to your vocabulary topics, saved translations, and quiz-based progress."}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/40 p-1">
          <button
            type="button"
            onClick={() => setMode("sign-up")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              mode === "sign-up"
                ? "bg-indigo-500 text-white"
                : "text-slate-300 hover:bg-white/5"
            }`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => setMode("sign-in")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              mode === "sign-in"
                ? "bg-indigo-500 text-white"
                : "text-slate-300 hover:bg-white/5"
            }`}
          >
            Sign in
          </button>
        </div>

        {mode === "sign-up" ? (
          <>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {signUpSteps.map((step, index) => {
                const isActive = step.id === signUpStep;
                const isDone = index < currentStepIndex;

                return (
                  <div
                    key={step.id}
                    className={`rounded-2xl border px-3 py-3 transition ${
                      isActive
                        ? "border-indigo-400/50 bg-indigo-500/10"
                        : isDone
                          ? "border-emerald-400/30 bg-emerald-500/10"
                          : "border-white/10 bg-slate-950/35"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                          isActive
                            ? "bg-indigo-400 text-slate-950"
                            : isDone
                              ? "bg-emerald-400 text-slate-950"
                              : "bg-white/10 text-slate-300"
                        }`}
                      >
                        {isDone ? "✓" : index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                          {step.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {step.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-indigo-300/90">
                {currentStep.label}
              </p>
              <h2 className="mt-2 text-base font-semibold text-white">
                {currentStep.title}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {currentStep.description}
              </p>
              {signUpStep !== "request-code" && (
                <p className="mt-3 text-xs text-slate-500">
                  Working with <span className="text-slate-300">{signUpEmail.trim()}</span>
                </p>
              )}
            </div>

            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (signUpStep === "request-code") {
                  requestCode.mutate();
                  return;
                }
                if (signUpStep === "verify-code") {
                  verifyCode.mutate();
                  return;
                }
                completeSignUp.mutate();
              }}
            >
              {signUpStep === "request-code" && (
                <>
                  <div className="space-y-2">
                    <label
                      htmlFor="full-name"
                      className="text-xs font-medium uppercase tracking-wide text-slate-400"
                    >
                      Full name
                    </label>
                    <input
                      id="full-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="signup-email"
                      className="text-xs font-medium uppercase tracking-wide text-slate-400"
                    >
                      Email
                    </label>
                    <input
                      id="signup-email"
                      type="email"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/30"
                    />
                  </div>
                </>
              )}

              {signUpStep === "verify-code" && (
                <>
                  <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
                    Your sign-up code has been sent. Enter it below to unlock the
                    password step.
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="code"
                      className="text-xs font-medium uppercase tracking-wide text-slate-400"
                    >
                      Verification code
                    </label>
                    <input
                      id="code"
                      inputMode="numeric"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="6-digit code"
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm tracking-[0.3em] text-white placeholder:tracking-normal placeholder:text-slate-500 outline-none transition focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/30"
                    />
                  </div>
                </>
              )}

              {signUpStep === "set-password" && (
                <>
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    Email verified. Now create your password to finish the account.
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="password"
                      className="text-xs font-medium uppercase tracking-wide text-slate-400"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="confirm-password"
                      className="text-xs font-medium uppercase tracking-wide text-slate-400"
                    >
                      Confirm password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/30"
                    />
                  </div>
                </>
              )}

              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error instanceof Error ? error.message : "Something went wrong"}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  isBusy ||
                  (signUpStep === "request-code" &&
                    (!fullName.trim() || !signUpEmail.trim())) ||
                  (signUpStep === "verify-code" && code.trim().length !== 6) ||
                  (signUpStep === "set-password" &&
                    (password.length < 8 || confirmPassword.length < 8))
                }
                className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {signUpStep === "request-code"
                  ? requestCode.isPending
                    ? "Sending code…"
                    : "Continue to verification"
                  : signUpStep === "verify-code"
                    ? verifyCode.isPending
                      ? "Verifying code…"
                      : "Continue to password"
                    : completeSignUp.isPending
                      ? "Creating account…"
                      : "Create account"}
              </button>

              {signUpStep !== "request-code" && (
                <button
                  type="button"
                  onClick={() => {
                    setSignUpStep("request-code");
                    setCode("");
                    setPassword("");
                    setConfirmPassword("");
                  }}
                  className="w-full text-sm text-slate-400 transition hover:text-slate-200"
                >
                  Start over with a different name or email
                </button>
              )}
            </form>
          </>
        ) : (
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              signIn.mutate();
            }}
          >
            <div className="space-y-2">
              <label
                htmlFor="signin-email"
                className="text-xs font-medium uppercase tracking-wide text-slate-400"
              >
                Email
              </label>
              <input
                id="signin-email"
                type="email"
                value={signInEmail}
                onChange={(e) => setSignInEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/30"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="signin-password"
                className="text-xs font-medium uppercase tracking-wide text-slate-400"
              >
                Password
              </label>
              <input
                id="signin-password"
                type="password"
                value={signInPassword}
                onChange={(e) => setSignInPassword(e.target.value)}
                placeholder="Your password"
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/30"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error instanceof Error ? error.message : "Something went wrong"}
              </p>
            )}

            <button
                    type="submit"
                    disabled={isBusy || !signInEmail.trim() || signInPassword.length < 8}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {signIn.isPending ? "Signing in…" : "Sign in"}
                  </button>
                </form>
              )}
        </section>
      </div>
    </div>
  );
}
