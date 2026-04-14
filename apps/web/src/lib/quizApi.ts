const baseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not set");
  return url;
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("mg-access") ?? ""}`,
  "Content-Type": "application/json",
});

export interface QuizQuestion {
  id: string;
  type: "MULTIPLE_CHOICE" | "TEXT_INPUT";
  question: string;
  options: string[];
}

export interface AnswerResult {
  correct: boolean;
  correctAnswer: string;
  explanation: string | null;
}

export interface NodeQuizStats {
  total: number;
  attempted: number;
  correct: number;
}

export async function fetchQuestions(nodeId: string): Promise<QuizQuestion[]> {
  const res = await fetch(`${baseUrl()}/quiz/${nodeId}`);
  if (!res.ok) throw new Error("Failed to fetch questions");
  return res.json();
}

export async function submitAnswer(questionId: string, answer: string): Promise<AnswerResult> {
  const res = await fetch(`${baseUrl()}/quiz/answer`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ questionId, answer }),
  });
  if (!res.ok) throw new Error("Failed to submit answer");
  return res.json();
}

export async function fetchQuizStats(nodeId: string): Promise<NodeQuizStats> {
  const res = await fetch(`${baseUrl()}/quiz/${nodeId}/stats`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch quiz stats");
  return res.json();
}
