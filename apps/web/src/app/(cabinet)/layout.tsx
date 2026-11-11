"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense } from "react";
import { ghostButtonClass, Notice, Skeleton } from "@/components/ui";
import { api, type User } from "@/lib/api";
import { SessionContext } from "@/lib/session";

const NAV = [
  { href: "/", label: "Обзор", adminOnly: false },
  { href: "/reviews", label: "Отзывы", adminOnly: false },
  { href: "/sync", label: "Синхронизация", adminOnly: true },
];

export default function CabinetLayout({ children }: LayoutProps<"/">) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/auth/me"),
  });

  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    // Только после подтверждения сервера: иначе cookie сессии осталась бы в браузере.
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
    },
  });

  if (me.isError) {
    return (
      <main className="mx-auto max-w-xl p-6">
        <Notice
          tone="error"
          title="Не удалось открыть кабинет"
          action={{ label: "Повторить", onClick: () => void me.refetch() }}
        >
          {me.error.message}
        </Notice>
      </main>
    );
  }

  const user = me.data;
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-lg font-semibold"
          >
            <svg aria-hidden viewBox="0 0 20 26" className="h-6 w-auto">
              <path
                d="M10 0C4.500 0 0 4.300 0 9.700 0 16.700 10 26 10 26s10-9.300 10-16.300C20 4.300 15.500 0 10 0z"
                fill="#d8402f"
              />
              <circle cx="10" cy="9.700" r="3.600" fill="#fff" />
            </svg>
            Геокабинет
          </Link>
          <nav
            aria-label="Разделы"
            className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto"
          >
            {NAV.filter(
              (item) => !item.adminOnly || user?.role === "admin",
            ).map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "bg-ink text-white" : "text-ink hover:bg-canvas"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <p className="text-right text-sm leading-tight">
                <span className="block font-medium">{user.fullName}</span>
                <span className="block text-muted">
                  {user.company?.name ?? "Администратор, все компании"}
                </span>
              </p>
            ) : (
              <Skeleton className="h-9 w-40" />
            )}
            <button
              type="button"
              className={ghostButtonClass}
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              Выйти
            </button>
          </div>
          {logout.isError && (
            <p role="alert" className="basis-full text-right text-sm text-down">
              Не удалось выйти: {logout.error.message}
            </p>
          )}
        </div>
      </header>
      <main className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
        {user ? (
          <SessionContext value={user}>
            <Suspense>{children}</Suspense>
          </SessionContext>
        ) : (
          <Skeleton className="h-64 w-full bg-surface" />
        )}
      </main>
    </div>
  );
}
