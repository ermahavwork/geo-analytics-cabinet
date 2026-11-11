import { defineConfig } from "@playwright/test";

/**
 * Сквозные сценарии в настоящем браузере. Ожидают запущенный стек с демо-данными
 * (docker compose up) и по умолчанию ходят на http://localhost:3000.
 */
export default defineConfig({
  testDir: "./e2e",
  // Сценарии меняют общие данные (статусы отзывов, синхронизация) — идут по очереди.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    locale: "ru-RU",
    // «Сегодня» в браузере совпадает с «сегодня» имитации геосервиса в любое время суток.
    timezoneId: "UTC",
    // Системные поля даты берут формат из языка самого браузера.
    launchOptions: {
      args: ["--lang=ru-RU"],
      env: { ...process.env, LANGUAGE: "ru_RU" },
    },
    trace: "retain-on-failure",
  },
});
