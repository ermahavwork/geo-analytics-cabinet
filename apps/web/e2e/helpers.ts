import { expect, type Page } from "@playwright/test";

export const ADMIN = { email: "admin@demo.local", password: "Admin-demo-2026" };
export const ZERNO = {
  email: "zerno@demo.local",
  password: "Client-demo-2026",
};

type Account = typeof ADMIN;
type Cookies = Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>>;

const sessions = new Map<string, Cookies>();

/**
 * Открывает кабинет под учётной записью. Входит один раз за прогон и дальше
 * переиспользует cookie: у входа есть лимит попыток, и тесты не должны его съедать.
 */
export async function login(page: Page, account: Account) {
  const saved = sessions.get(account.email);
  if (saved) {
    await page.context().addCookies(saved);
  } else {
    const response = await page.request.post("/api/auth/login", {
      data: account,
    });
    expect(response.ok()).toBe(true);
    sessions.set(account.email, await page.context().cookies());
  }
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/** Вход через форму — так, как это делает человек. */
export async function loginViaForm(page: Page, account: Account) {
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill(account.email);
  await page.getByLabel("Пароль").fill(account.password);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/** Скриншот для README. Снимается, только если задан каталог SCREENSHOTS_DIR. */
export async function shot(page: Page, name: string) {
  const dir = process.env.SCREENSHOTS_DIR;
  if (dir)
    await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}
