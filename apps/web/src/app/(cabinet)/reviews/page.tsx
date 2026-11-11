"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ScopeFilters, useScope } from "@/components/scope-filters";
import {
  Notice,
  Pagination,
  Panel,
  Select,
  Skeleton,
  Stars,
} from "@/components/ui";
import {
  api,
  type Paged,
  query,
  type Review,
  REVIEW_STATUSES,
  type ReviewStatus,
} from "@/lib/api";
import { formatDateTime, STATUS_LABELS } from "@/lib/format";
import { useUser } from "@/lib/session";
import { useFilters } from "@/lib/use-filters";

const PER_PAGE = 10;

const STATUS_TONE: Record<ReviewStatus, string> = {
  new: "border-pin text-pin",
  in_progress: "border-route text-route",
  processed: "border-line text-muted",
};

function ReviewCard({ review }: { review: Review }) {
  const queryClient = useQueryClient();
  const setStatus = useMutation({
    mutationFn: (status: ReviewStatus) =>
      api<Review>(`/reviews/${review.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reviews"] }),
  });
  // Пока запрос идёт, показываем выбранное значение; при ошибке возвращаемся к сохранённому.
  const status = setStatus.isPending ? setStatus.variables : review.status;

  return (
    <li className="flex flex-col gap-3 border-b border-line px-5 py-4 last:border-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Stars rating={review.rating} />
          <span className="font-medium">{review.authorName}</span>
          <span className="text-muted">
            {formatDateTime(review.publishedAt)}
          </span>
        </p>
        <p className="mt-2 max-w-prose">{review.text}</p>
        <p className="mt-2 text-sm text-muted">{review.branch.name}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1 sm:items-end">
        <Select
          label="Статус обработки"
          className={`border-2 font-medium ${STATUS_TONE[status]}`}
          value={status}
          disabled={setStatus.isPending}
          onChange={(event) =>
            setStatus.mutate(event.target.value as ReviewStatus)
          }
        >
          {REVIEW_STATUSES.map((value) => (
            <option key={value} value={value} className="text-ink">
              {STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
        {setStatus.isError && (
          <p role="alert" className="max-w-48 text-xs text-down">
            Статус не сохранён: {setStatus.error.message}
          </p>
        )}
      </div>
    </li>
  );
}

export default function ReviewsPage() {
  const user = useUser();
  const { params, set } = useFilters();
  const { companyId, branchId } = useScope();
  const rating = params.get("rating");
  const status = params.get("status");
  const page = Math.max(1, Number(params.get("page")) || 1);

  const filters = {
    companyId: user.role === "admin" ? companyId : null,
    branchId,
    rating,
    status,
    page,
    limit: PER_PAGE,
  };
  const reviews = useQuery({
    queryKey: ["reviews", filters],
    queryFn: () => api<Paged<Review>>(`/reviews?${query(filters)}`),
    placeholderData: keepPreviousData,
  });
  const filtered = Boolean(branchId || rating || status);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Отзывы</h1>
          <p className="mt-1 text-sm text-muted">
            {reviews.data
              ? `Найдено: ${reviews.data.total.toLocaleString("ru-RU")}`
              : "Загружаем отзывы…"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <ScopeFilters />
          <Select
            label="Оценка"
            value={rating ?? ""}
            onChange={(event) =>
              set({ rating: event.target.value || null, page: null })
            }
          >
            <option value="">Любая</option>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {"★".repeat(value)} — {value}
              </option>
            ))}
          </Select>
          <Select
            label="Статус обработки"
            value={status ?? ""}
            onChange={(event) =>
              set({ status: event.target.value || null, page: null })
            }
          >
            <option value="">Любой</option>
            {REVIEW_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Panel
        className={
          reviews.isPlaceholderData ? "opacity-60 transition-opacity" : ""
        }
      >
        {reviews.isError ? (
          <Notice
            tone="error"
            title="Не удалось загрузить отзывы"
            action={
              filtered
                ? {
                    label: "Сбросить фильтры",
                    onClick: () =>
                      set({
                        branch: null,
                        rating: null,
                        status: null,
                        page: null,
                      }),
                  }
                : { label: "Повторить", onClick: () => void reviews.refetch() }
            }
          >
            {reviews.error.message}
          </Notice>
        ) : !reviews.data ? (
          <div className="flex flex-col gap-3 p-5">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : reviews.data.total === 0 ? (
          <Notice
            title={
              filtered ? "Под эти условия отзывов нет" : "Отзывов пока нет"
            }
            action={
              filtered
                ? {
                    label: "Сбросить фильтры",
                    onClick: () =>
                      set({
                        branch: null,
                        rating: null,
                        status: null,
                        page: null,
                      }),
                  }
                : undefined
            }
          >
            {filtered
              ? "Измените оценку, статус или филиал."
              : "Новые отзывы появятся здесь, как только клиенты их оставят."}
          </Notice>
        ) : (
          <>
            <ul>
              {reviews.data.items.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </ul>
            <Pagination
              page={page}
              limit={PER_PAGE}
              total={reviews.data.total}
              onPage={(next) => set({ page: next === 1 ? null : String(next) })}
            />
          </>
        )}
      </Panel>
    </>
  );
}
