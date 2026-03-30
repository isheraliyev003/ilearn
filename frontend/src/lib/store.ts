"use client";

import type { TopicQuizDto } from "@ilearn/shared";
import { combineReducers, configureStore, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
} from "redux-persist";
import createWebStorage from "redux-persist/lib/storage/createWebStorage";

export type PersistedAnswerResult = {
  selectedOption: string;
  isCorrect: boolean;
};

export type QuizSession = {
  quiz: TopicQuizDto;
  quizFingerprint: string;
  currentIndex: number;
  selectedOption: string | null;
  answers: Record<number, PersistedAnswerResult>;
  resultsSynced: boolean;
};

type QuizState = {
  sessions: Record<string, QuizSession>;
};

function createNoopStorage() {
  return {
    getItem() {
      return Promise.resolve(null);
    },
    setItem(_key: string, value: string) {
      return Promise.resolve(value);
    },
    removeItem() {
      return Promise.resolve();
    },
  };
}

const storage =
  typeof window !== "undefined"
    ? createWebStorage("local")
    : createNoopStorage();

const quizSlice = createSlice({
  name: "quiz",
  initialState: { sessions: {} } as QuizState,
  reducers: {
    initializeQuizSession(
      state,
      action: PayloadAction<{ topicId: string; quiz: TopicQuizDto }>,
    ) {
      state.sessions[action.payload.topicId] = {
        quiz: action.payload.quiz,
        quizFingerprint: action.payload.quiz.questions
          .map((question) => question.id)
          .join("|"),
        currentIndex: 0,
        selectedOption: null,
        answers: {},
        resultsSynced: false,
      };
    },
    setQuizSelectedOption(
      state,
      action: PayloadAction<{ topicId: string; selectedOption: string | null }>,
    ) {
      const session = state.sessions[action.payload.topicId];
      if (!session) {
        return;
      }
      session.selectedOption = action.payload.selectedOption;
    },
    submitQuizAnswer(state, action: PayloadAction<{ topicId: string }>) {
      const session = state.sessions[action.payload.topicId];
      if (!session) {
        return;
      }

      const question = session.quiz.questions[session.currentIndex];
      if (!question || !session.selectedOption) {
        return;
      }

      session.answers[session.currentIndex] = {
        selectedOption: session.selectedOption,
        isCorrect: session.selectedOption === question.correctAnswer,
      };
      session.currentIndex += 1;
      session.selectedOption = null;
    },
    clearQuizSession(state, action: PayloadAction<{ topicId: string }>) {
      delete state.sessions[action.payload.topicId];
    },
    markQuizResultsSynced(
      state,
      action: PayloadAction<{ topicId: string; quizFingerprint: string }>,
    ) {
      const session = state.sessions[action.payload.topicId];
      if (!session || session.quizFingerprint !== action.payload.quizFingerprint) {
        return;
      }
      session.resultsSynced = true;
    },
  },
});

const rootReducer = combineReducers({
  quiz: quizSlice.reducer,
});

const persistedReducer = persistReducer(
  {
    key: "ilearn-root",
    storage,
    whitelist: ["quiz"],
  },
  rootReducer,
);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export const {
  clearQuizSession,
  initializeQuizSession,
  markQuizResultsSynced,
  setQuizSelectedOption,
  submitQuizAnswer,
} = quizSlice.actions;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
