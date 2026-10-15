import type { Answer, PublicQuestion } from "../questions/model";
export type Phase =
  "lobby" | "question" | "result" | "leaderboard" | "finished";
export type SessionSummary = {
  id: string;
  title: string;
  code: string;
  phase: Phase;
  capacity: number;
  total: number;
  created_at: string;
  view_token: string;
};
export type Standing = {
  id: string;
  name: string;
  score: number;
  rank: number;
  tied?: boolean;
};
export type GameView = {
  id: string;
  title: string;
  code: string;
  phase: Phase;
  capacity: number;
  revision: number;
  index: number;
  total: number;
  roundId: string;
  question: PublicQuestion;
  deadline: string | null;
  serverTime: string;
  count: number;
  answered: number;
  standings: Standing[];
  myId: string | null;
  myAnswer: { payload: Answer; correct?: boolean; points?: number } | null;
  host: boolean;
  syncTopic: string;
  buzzOpen: boolean;
  buzzWinner: {
    id: string;
    name: string;
    graded: boolean;
    hopeStar?: boolean;
  } | null;
  star: { selected: boolean; used: boolean };
  starRounds: number;
  tiebreak: {
    active: boolean;
    pending: boolean;
    myEligible: boolean;
    candidates: { id: string; name: string }[];
    reserves: number;
  };
  hintCount: number;
  hintTotal: number;
  guess: { lng: number; lat: number } | null;
};
export type Control = "start" | "reveal" | "leaderboard" | "next" | "finish";
export type SessionPlan = {
  id: string;
  title: string;
  capacity: number;
  phase: Phase;
  questionIds: string[];
  starQuestionIds: string[];
  reserveQuestionIds: string[];
  reserveQuestions: import("../questions/model").Question[];
  questions: import("../questions/model").Question[];
};
