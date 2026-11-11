"use client";

import { ghostButtonClass } from "@/components/ui";

/** Последний рубеж: непредвиденная ошибка отрисовки не оставляет пустой экран. */
export default function GlobalError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-3 p-6">
      <h1 className="font-display text-2xl font-semibold">
        Страница не отобразилась
      </h1>
      <p className="text-muted">
        Данные не пострадали. Попробуйте открыть страницу ещё раз.
      </p>
      <button type="button" className={ghostButtonClass} onClick={reset}>
        Повторить
      </button>
    </main>
  );
}
