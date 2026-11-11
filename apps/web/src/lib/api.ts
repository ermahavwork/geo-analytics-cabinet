type Role = "admin" | "client";

export interface Company {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  company: Company | null;
}

export interface Branch {
  id: string;
  companyId: string;
  name: string;
  city: string;
  address: string;
}

export const METRICS = ["views", "siteClicks", "calls", "routes"] as const;
export type Metric = (typeof METRICS)[number];

interface Totals extends Record<Metric, number> {
  reviewsCount: number;
  avgRating: number | null;
}

export interface Summary {
  current: Totals;
  previous: Totals;
  previousPeriod: { from: string; to: string };
}

export interface Timeseries {
  metric: Metric;
  points: { date: string; value: number }[];
}

export interface BranchStats extends Totals {
  branch: Branch & { companyName: string };
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export const REVIEW_STATUSES = ["new", "in_progress", "processed"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface Review {
  id: string;
  branch: { id: string; name: string };
  authorName: string;
  rating: number;
  text: string;
  status: ReviewStatus;
  publishedAt: string;
}

export interface SyncRun {
  id: string;
  dateFrom: string;
  dateTo: string;
  status: "running" | "success" | "partial" | "failed";
  branchesTotal: number;
  branchesFailed: number;
  rowsReceived: number;
  rowsChanged: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

/** Ошибка запроса с понятным пользователю текстом. status 0 — нет связи. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "Нет связи с сервером. Проверьте сеть и повторите.");
  }
  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join("; ")
      : body?.message;
    throw new ApiError(
      response.status,
      // Текст внутренней ошибки сервера пользователю ничего не скажет.
      (response.status !== 500 && message) ||
        "Сервер не смог обработать запрос. Повторите позже.",
    );
  }
  return body as T;
}

/** Собирает строку запроса, пропуская пустые значения. */
export function query(
  params: Record<string, string | number | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "")
      search.set(key, String(value));
  }
  return search.toString();
}
