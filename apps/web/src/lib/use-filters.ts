"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/**
 * Фильтры живут в адресной строке: ссылку с выбранным филиалом и периодом можно
 * переслать коллеге, а «назад» в браузере возвращает прежний срез.
 */
export function useFilters() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const set = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const search = next.toString();
      router.push(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  return { params, set };
}
