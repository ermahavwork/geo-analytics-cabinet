"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";

/** Сессия истекла или отозвана: чистим cookie и отправляем на вход. */
async function onSessionLost() {
  if (window.location.pathname === "/login") return;
  await api("/auth/logout", { method: "POST" }).catch(() => undefined);
  // Полная перезагрузка намеренна: сбрасывает всё состояние прежней сессии.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/login?expired=1");
}

function onError(error: Error) {
  if (error instanceof ApiError && error.status === 401) void onSessionLost();
}

function createClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Повторяем только сбои сети и сервера: 4xx от повтора не исправится.
        retry: (failures, error) =>
          failures < 2 &&
          !(
            error instanceof ApiError &&
            error.status < 500 &&
            error.status !== 0
          ),
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(createClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
