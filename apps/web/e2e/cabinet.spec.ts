import { expect, test } from "@playwright/test";
import { ADMIN, login, loginViaForm, shot, ZERNO } from "./helpers";

test.describe("Вход", () => {
  test("без сессии кабинет недоступен, неверный пароль объясняется", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await shot(page, "01-login");

    await page.getByLabel("Электронная почта").fill(ZERNO.email);
    await page.getByLabel("Пароль").fill("wrong-password");
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Неверный email или пароль",
    );
  });

  test("вход через форму открывает кабинет, после выхода он снова закрыт", async ({
    page,
  }) => {
    await loginViaForm(page, ZERNO);
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/reviews");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("Клиент", () => {
  test.beforeEach(({ page }) => login(page, ZERNO));

  test("видит шесть показателей, график и только свои филиалы", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Все филиалы компании" }),
    ).toBeVisible();
    for (const label of [
      "Просмотры карточек",
      "Переходы на сайт",
      "Звонки",
      "Построено маршрутов",
      "Средний рейтинг",
      "Отзывы",
    ]) {
      await expect(
        page.getByRole("main").getByText(label, { exact: true }).first(),
      ).toBeVisible();
    }
    await expect(
      page.getByRole("heading", { name: "Просмотры карточек по дням" }),
    ).toBeVisible();
    await expect(page.locator(".recharts-area-curve")).toBeVisible();

    const rows = page.getByRole("table").getByRole("row");
    await expect(rows).toHaveCount(5); // заголовок + 4 филиала «Зерна»
    await expect(page.getByText("Улыбка")).toHaveCount(0);
    await expect(page.getByText("Гараж 24")).toHaveCount(0);

    await expect(page.getByLabel("Компания")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Синхронизация" })).toHaveCount(
      0,
    );
    await shot(page, "02-dashboard-client");
  });

  test("выбирает филиал, показатель и период — срез сохраняется в адресе", async ({
    page,
  }) => {
    const views = page.getByRole("button", { name: /Просмотры карточек/ });
    const allBranches = await views.innerText();

    await page.getByRole("button", { name: /Зерно на Лесной/ }).click();
    await expect(page).toHaveURL(/branch=/);
    await expect(
      page.getByRole("heading", { name: "Зерно на Лесной, Москва" }),
    ).toBeVisible();
    await expect(views).not.toHaveText(allBranches);

    await page.getByRole("button", { name: /^Звонки/ }).click();
    await expect(
      page.getByRole("heading", { name: "Звонки по дням" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "7 дней" }).click();
    await expect(page).toHaveURL(/days=7/);
    await shot(page, "03-dashboard-branch");

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Зерно на Лесной, Москва" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Звонки по дням" }),
    ).toBeVisible();

    await page.getByLabel("Филиал").selectOption({ label: "Все филиалы" });
    await expect(
      page.getByRole("heading", { name: "Все филиалы компании" }),
    ).toBeVisible();
  });

  test("фильтрует отзывы по оценке и статусу, меняет статус обработки", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Отзывы" }).first().click();
    await expect(page.getByRole("heading", { name: "Отзывы" })).toBeVisible();
    await shot(page, "04-reviews");

    await page.getByLabel("Оценка", { exact: true }).selectOption("1");
    await page.getByLabel("Статус обработки").first().selectOption("new");
    await expect(page).toHaveURL(/rating=1.*status=new/);
    const cards = page.getByRole("listitem");
    await expect(cards.first()).toBeVisible();
    for (const card of await cards.all()) {
      await expect(
        card.getByRole("img", { name: "Оценка 1 из 5" }),
      ).toBeVisible();
    }
    await shot(page, "05-reviews-filtered");

    // Берём один отзыв в работу: из выборки «Новый» он уходит, в «В работе» появляется.
    const author = await cards.first().locator("p").first().innerText();
    const found = page.getByText(/^Найдено: \d+$/);
    const before = Number((await found.innerText()).replace(/\D/g, ""));
    await cards
      .first()
      .getByLabel("Статус обработки")
      .selectOption("in_progress");
    await expect(found).toHaveText(`Найдено: ${before - 1}`);

    await page
      .getByLabel("Статус обработки")
      .first()
      .selectOption("in_progress");
    const moved = page
      .getByRole("listitem")
      .filter({ hasText: author.split("\n")[0] })
      .first();
    await expect(moved).toBeVisible();
    await moved.getByLabel("Статус обработки").selectOption("new");
    await expect(found).toBeVisible();
  });

  test("на телефоне страница не уезжает вбок, показатели и график на месте", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByRole("button", { name: /Просмотры карточек/ }),
    ).toBeVisible();
    await expect(page.locator(".recharts-area-curve")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await shot(page, "09-mobile");
  });

  test("прямой заход в раздел администратора и прямые запросы к API отклоняются", async ({
    page,
  }) => {
    await page.goto("/sync");
    await expect(
      page.getByText("Раздел доступен только администратору"),
    ).toBeVisible();

    const sync = await page.request.post("/api/sync/metrics", {
      data: { from: "2026-01-01", to: "2026-01-02" },
    });
    expect(sync.status()).toBe(403);

    // Идентификатор чужой компании берём из сессии администратора в отдельном контексте.
    const adminContext = await page
      .context()
      .browser()!
      .newContext({ baseURL: test.info().project.use.baseURL });
    await adminContext.request.post("/api/auth/login", { data: ADMIN });
    const companies: { id: string; name: string }[] = await (
      await adminContext.request.get("/api/companies")
    ).json();
    await adminContext.close();
    const foreign = companies.find(
      (company) => !company.name.includes("Зерно"),
    )!;

    const summary = await page.request.get(
      `/api/analytics/summary?from=2026-01-01&to=2026-01-31&companyId=${foreign.id}`,
    );
    expect(summary.status()).toBe(403);
    const reviews = await page.request.get(
      `/api/reviews?companyId=${foreign.id}`,
    );
    expect(reviews.status()).toBe(403);
  });

  test("сбой загрузки показывает понятную ошибку и кнопку повтора", async ({
    page,
  }) => {
    await page.route("**/api/analytics/summary**", (route) => route.abort());
    await page.reload();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Не удалось загрузить показатели",
      { timeout: 20_000 },
    );
    await shot(page, "08-error-state");

    await page.unroute("**/api/analytics/summary**");
    await page.getByRole("button", { name: "Повторить" }).click();
    await expect(
      page.getByRole("button", { name: /Просмотры карточек/ }),
    ).toBeVisible();
  });

  test("некорректный срез из адреса объясняется, фильтры остаются, сброс возвращает данные", async ({
    page,
  }) => {
    await page.goto("/?from=2020-01-01&to=2026-01-01");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Период не может быть длиннее 366 дней",
    );
    await expect(page.getByLabel("Филиал")).toBeVisible();

    await page.getByRole("button", { name: "Сбросить фильтры" }).click();
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("button", { name: /Просмотры карточек/ }),
    ).toBeVisible();
  });

  test("слишком длинный период при вводе дат не уходит в запрос, а объясняется рядом с полями", async ({
    page,
  }) => {
    const day = (ago: number) =>
      new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);
    const views = page.getByRole("button", { name: /Просмотры карточек/ });
    await expect(views).toBeVisible();

    await page.getByLabel("С", { exact: true }).fill(day(2000));
    await expect(
      page.getByText("Период не может быть длиннее 366 дней"),
    ).toBeVisible();
    await expect(page).toHaveURL("/");
    await expect(views).toBeVisible();

    await page.getByLabel("С", { exact: true }).fill(day(40));
    await expect(page).toHaveURL(new RegExp(`from=${day(40)}&to=${day(0)}`));
    await page.getByLabel("По", { exact: true }).fill(day(10));
    await expect(page).toHaveURL(new RegExp(`from=${day(40)}&to=${day(10)}`));

    // «Назад» возвращает предыдущий срез, а не уводит из кабинета.
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`from=${day(40)}&to=${day(0)}`));
  });

  test("истёкшая сессия возвращает на вход с пояснением", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await context.addCookies([
      {
        name: "cabinet_session",
        value: "expired-token",
        url: test.info().project.use.baseURL!,
      },
    ]);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login\?expired=1$/);
    await expect(
      page.getByText("Сессия завершилась. Войдите снова."),
    ).toBeVisible();
  });
});

test.describe("Администратор", () => {
  test.beforeEach(({ page }) => login(page, ADMIN));

  test("видит все компании и может сузить выборку до одной", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Все компании и филиалы" }),
    ).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(10); // заголовок + 9 филиалов
    await expect(page.getByLabel("Компания").getByRole("option")).toHaveCount(
      4,
    ); // «Все» + 3 компании
    await shot(page, "06-dashboard-admin");

    await page
      .getByLabel("Компания")
      .selectOption({ label: "Стоматология «Улыбка»" });
    await expect(
      page.getByRole("heading", { name: "Все филиалы компании" }),
    ).toBeVisible();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(4);
  });

  test("запускает синхронизацию; повторный запуск ничего не дублирует", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Синхронизация" }).click();
    const run = page.getByRole("button", { name: "Загрузить статистику" });

    await run.click();
    await expect(page.getByText(/Готово\. Получено строк: 63/)).toBeVisible({
      timeout: 30_000,
    });

    await run.click();
    await expect(
      page.getByText(/Получено строк: 63, из них новых или изменённых: 0\./),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("table").getByRole("row").nth(1)).toContainText(
      "Успешно",
    );
    await shot(page, "07-sync");
  });
});
