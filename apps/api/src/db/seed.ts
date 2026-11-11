import bcrypt from 'bcryptjs';
import type { DataSource } from 'typeorm';
import { generateRange, seededRandom } from '../mock-geo/generator.js';

/** Демо-доступы. Данные вымышленные, пароли намеренно открыты — они же в README. */
const DEMO_ADMIN = {
  email: 'admin@demo.local',
  password: 'Admin-demo-2026',
};
const DEMO_CLIENT_PASSWORD = 'Client-demo-2026';

const METRIC_DAYS = 180;
const REVIEW_DAYS = 120;
const DAY_MS = 86_400_000;

const COMPANIES = [
  {
    name: 'Кофейни «Зерно»',
    user: ['zerno@demo.local', 'Марина Кофеева'],
    branches: [
      ['Зерно на Лесной', 'Москва', 'ул. Лесная, 12'],
      ['Зерно на Проспекте', 'Москва', 'пр-т Мира, 48'],
      ['Зерно у Канала', 'Санкт-Петербург', 'наб. канала Грибоедова, 30'],
      ['Зерно на Баумана', 'Казань', 'ул. Баумана, 7'],
    ],
  },
  {
    name: 'Стоматология «Улыбка»',
    user: ['ulybka@demo.local', 'Олег Зубов'],
    branches: [
      ['Улыбка — Центр', 'Екатеринбург', 'ул. Малышева, 51'],
      [
        'Улыбка — Академический',
        'Екатеринбург',
        'ул. Вильгельма де Геннина, 34',
      ],
      ['Улыбка — Левый берег', 'Новосибирск', 'ул. Блюхера, 17'],
    ],
  },
  {
    name: 'Автосервис «Гараж 24»',
    user: ['garage@demo.local', 'Игорь Моторин'],
    branches: [
      ['Гараж 24 — Северный', 'Нижний Новгород', 'ул. Бекетова, 60'],
      ['Гараж 24 — Заречный', 'Нижний Новгород', 'пр-т Ленина, 88'],
    ],
  },
];

const AUTHORS = [
  'Анна К.',
  'Дмитрий С.',
  'Елена В.',
  'Сергей П.',
  'Ольга М.',
  'Иван Т.',
  'Наталья Р.',
  'Алексей Б.',
  'Мария Г.',
  'Павел Н.',
  'Юлия Д.',
  'Тимур А.',
];

const TEXTS: Record<number, string[]> = {
  5: [
    'Всё понравилось, обязательно приду ещё.',
    'Быстро, вежливо и по делу. Рекомендую.',
    'Лучшее место в районе, спасибо команде!',
    'Записался по телефону за минуту, приняли вовремя.',
    'Нашёл по карте, маршрут довёл прямо до входа. Отлично.',
  ],
  4: [
    'Хорошо, но в час пик пришлось подождать.',
    'Качество отличное, цены чуть выше среднего.',
    'В целом доволен, мелкие замечания по парковке.',
    'Всё аккуратно, но вход со двора найти непросто.',
  ],
  3: [
    'Нормально, без восторга. Ожидал большего.',
    'Сервис средний: что-то хорошо, что-то нет.',
    'Часы работы на карте не совпали с реальными.',
  ],
  2: [
    'Долго ждал, администратор не извинился.',
    'По телефону обещали одно, на месте оказалось другое.',
    'На сайте одна цена, на месте назвали другую.',
  ],
  1: [
    'Не дозвонился ни с третьего раза, разочарован.',
    'Пришёл к назначенному времени, а принять не смогли.',
    'Приехал по адресу с карты — филиал оказался закрыт.',
  ],
};

const pick = <T>(random: () => number, weighted: [T, number][]): T => {
  let roll = random() * weighted.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [value, weight] of weighted) {
    if ((roll -= weight) < 0) return value;
  }
  return weighted[0][0];
};

function demoReviews(externalId: string, now: number) {
  const random = seededRandom(`reviews:${externalId}`);
  const count = 30 + Math.floor(random() * 20);
  return Array.from({ length: count }, (_, i) => {
    const ageDays = random() * REVIEW_DAYS;
    const rating = pick(random, [
      [5, 45],
      [4, 25],
      [3, 12],
      [2, 8],
      [1, 10],
    ]);
    const texts = TEXTS[rating];
    return {
      externalId: `rev-${externalId}-${i}`,
      authorName: AUTHORS[Math.floor(random() * AUTHORS.length)],
      rating,
      text: texts[Math.floor(random() * texts.length)],
      // Свежие отзывы чаще ещё не разобраны, старые — уже обработаны.
      status: pick<string>(
        random,
        ageDays < 21
          ? [
              ['new', 60],
              ['in_progress', 25],
              ['processed', 15],
            ]
          : [
              ['new', 8],
              ['in_progress', 12],
              ['processed', 80],
            ],
      ),
      publishedAt: new Date(now - ageDays * DAY_MS).toISOString(),
    };
  });
}

/**
 * Статистика за период, где сегодняшний день ещё неполный — как в жизни на момент
 * выгрузки. Первая синхронизация с геосервисом дотянет его до актуальных значений.
 */
function demoMetrics(externalId: string, from: string, to: string) {
  const days = generateRange(externalId, from, to);
  const today = days[days.length - 1];
  for (const key of ['views', 'siteClicks', 'calls', 'routes'] as const) {
    today[key] = Math.round(today[key] * 0.6);
  }
  return days;
}

/** Наполняет пустую базу вымышленными компаниями. Повторный вызов ничего не меняет. */
export async function seedDemo(owner: DataSource): Promise<boolean> {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const firstDay = new Date(now - (METRIC_DAYS - 1) * DAY_MS)
    .toISOString()
    .slice(0, 10);

  return owner.transaction(async (em) => {
    if ((await em.query(`SELECT 1 FROM companies LIMIT 1`)).length)
      return false;

    await em.query(
      `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, 'Администратор', 'admin')`,
      [DEMO_ADMIN.email, await bcrypt.hash(DEMO_ADMIN.password, 10)],
    );
    const clientHash = await bcrypt.hash(DEMO_CLIENT_PASSWORD, 10);

    for (const [companyIndex, company] of COMPANIES.entries()) {
      const [{ id: companyId }] = await em.query(
        `INSERT INTO companies (name) VALUES ($1) RETURNING id`,
        [company.name],
      );
      await em.query(
        `INSERT INTO users (email, password_hash, full_name, role, company_id) VALUES ($1, $2, $3, 'client', $4)`,
        [company.user[0], clientHash, company.user[1], companyId],
      );

      for (const [
        branchIndex,
        [name, city, address],
      ] of company.branches.entries()) {
        const externalId = `geo-${companyIndex + 1}0${branchIndex + 1}`;
        const [{ id: branchId }] = await em.query(
          `INSERT INTO branches (company_id, name, city, address, external_id)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [companyId, name, city, address, externalId],
        );
        await em.query(
          `INSERT INTO daily_metrics (branch_id, company_id, date, views, site_clicks, calls, routes)
           SELECT $1, $2, d.date, d.views, d."siteClicks", d.calls, d.routes
             FROM jsonb_to_recordset($3::jsonb)
               AS d(date date, views int, "siteClicks" int, calls int, routes int)`,
          [
            branchId,
            companyId,
            JSON.stringify(demoMetrics(externalId, firstDay, today)),
          ],
        );
        await em.query(
          `INSERT INTO reviews (branch_id, company_id, external_id, author_name, rating, text, status, published_at)
           SELECT $1, $2, r."externalId", r."authorName", r.rating, r.text, r.status::review_status, r."publishedAt"
             FROM jsonb_to_recordset($3::jsonb)
               AS r("externalId" text, "authorName" text, rating smallint, text text, status text, "publishedAt" timestamptz)`,
          [branchId, companyId, JSON.stringify(demoReviews(externalId, now))],
        );
      }
    }
    return true;
  });
}
