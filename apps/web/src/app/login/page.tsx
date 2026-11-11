"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { buttonClass, fieldClass } from "@/components/ui";
import { api, type User } from "@/lib/api";

/** Вымышленные учётные записи из демо-данных — чтобы проверить роли в один клик. */
const DEMO_ACCOUNTS = [
  {
    label: "Администратор — видит все компании",
    email: "admin@demo.local",
    password: "Admin-demo-2026",
  },
  {
    label: "Клиент — кофейни «Зерно»",
    email: "zerno@demo.local",
    password: "Client-demo-2026",
  },
  {
    label: "Клиент — стоматология «Улыбка»",
    email: "ulybka@demo.local",
    password: "Client-demo-2026",
  },
  {
    label: "Клиент — автосервис «Гараж 24»",
    email: "garage@demo.local",
    password: "Client-demo-2026",
  },
];

function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const expired = useSearchParams().has("expired");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: () =>
      api<{ user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      }),
    onSuccess: () => {
      // Кэш прежнего пользователя не должен достаться следующему.
      queryClient.clear();
      router.replace("/");
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        login.mutate();
      }}
    >
      {expired && !login.isError && (
        <p role="status" className="rounded-lg bg-route-soft px-3 py-2 text-sm">
          Сессия завершилась. Войдите снова.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm text-muted">
        Электронная почта
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          className={fieldClass}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        Пароль
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className={fieldClass}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {login.isError && (
        <p role="alert" className="text-sm text-down">
          {login.error.message}
        </p>
      )}
      <button
        type="submit"
        className={buttonClass}
        disabled={login.isPending || login.isSuccess}
      >
        {login.isPending || login.isSuccess ? "Входим…" : "Войти"}
      </button>

      <div className="mt-2 border-t border-line pt-4">
        <p className="mb-2 text-sm text-muted">
          Демо-доступы — нажмите, чтобы подставить
        </p>
        <ul className="flex flex-col gap-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                className="w-full rounded-lg border border-line px-3 py-2 text-left text-sm transition-colors hover:border-route"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
              >
                <span className="block text-ink">{account.label}</span>
                <span className="block text-muted">{account.email}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-end">
        {/* Условная карта: кварталы, маршрут и метки филиалов. */}
        <svg
          aria-hidden
          viewBox="0 0 600 600"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 size-full"
        >
          <g stroke="#2a3b47" strokeWidth="1.5" fill="none">
            <path d="M-20 140 L620 90 M-20 300 L620 260 M-20 470 L620 430 M110 -20 L160 620 M300 -20 L330 620 M480 -20 L500 620" />
          </g>
          <path
            d="M80 370 C 150 300, 190 270, 280 245 S 440 190, 510 85"
            stroke="#6f93ea"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="1 12"
            fill="none"
          />
          {[
            [80, 370],
            [280, 245],
            [510, 85],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <path
                d="M0 -30c-10 0-17 7.500-17 17 0 12 17 29 17 29s17-17 17-29c0-9.500-7-17-17-17z"
                fill="#d8402f"
              />
              <circle cy="-13" r="6" fill="#fff" />
            </g>
          ))}
        </svg>
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-ink to-transparent"
        />
        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Как вас находят на картах
          </h1>
          <p className="mt-4 text-lg text-[#b9c6ce]">
            Просмотры карточек, звонки, маршруты и отзывы по каждому филиалу — в
            одном кабинете.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center bg-surface px-6 py-10">
        <div className="w-full max-w-sm">
          <h2 className="mb-6 font-display text-2xl font-semibold">
            Вход в Геокабинет
          </h2>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
