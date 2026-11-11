import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source.js';

/**
 * Нагрузочные данные для проверки запросов на целевом масштабе:
 * 500 компаний × 6 филиалов × 365 дней ≈ 1,1 млн строк метрик.
 * Запуск: npm run db:seed:scale (нужен DATABASE_OWNER_URL).
 */
const COMPANIES = 500;
const BRANCHES_PER_COMPANY = 6;
const DAYS = 365;
const REVIEWS_PER_BRANCH = 40;

const owner = new DataSource(
  dataSourceOptions(process.env.DATABASE_OWNER_URL!),
);
await owner.initialize();
try {
  await owner.transaction(async (em) => {
    await em.query(
      `INSERT INTO companies (name)
       SELECT 'Нагрузочная компания ' || n FROM generate_series(1, $1) n
       ON CONFLICT (name) DO NOTHING`,
      [COMPANIES],
    );
    await em.query(
      `INSERT INTO branches (company_id, name, city, address, external_id)
       SELECT c.id, 'Филиал ' || n, 'Город ' || (n % 50), 'ул. Тестовая, ' || n,
              'load-' || c.id || '-' || n
         FROM companies c, generate_series(1, $1) n
        WHERE c.name LIKE 'Нагрузочная компания %'
       ON CONFLICT (external_id) DO NOTHING`,
      [BRANCHES_PER_COMPANY],
    );
    await em.query(
      `INSERT INTO daily_metrics (branch_id, company_id, date, views, site_clicks, calls, routes)
       SELECT b.id, b.company_id, d::date,
              (100 + random() * 900)::int, (random() * 80)::int, (random() * 30)::int, (random() * 50)::int
         FROM branches b, generate_series(current_date - $1::int + 1, current_date, interval '1 day') d
        WHERE b.external_id LIKE 'load-%'
       ON CONFLICT (branch_id, date) DO NOTHING`,
      [DAYS],
    );
    await em.query(
      `INSERT INTO reviews (branch_id, company_id, external_id, author_name, rating, text, status, published_at)
       SELECT b.id, b.company_id, 'load-' || b.id || '-' || n, 'Автор ' || n,
              1 + (random() * 4)::int, 'Нагрузочный отзыв',
              (ARRAY['new', 'in_progress', 'processed'])[1 + (random() * 2)::int]::review_status,
              now() - random() * interval '365 days'
         FROM branches b, generate_series(1, $1) n
        WHERE b.external_id LIKE 'load-%'
       ON CONFLICT (external_id) DO NOTHING`,
      [REVIEWS_PER_BRANCH],
    );
  });
  await owner.query(`ANALYZE`);
  const [counts] = await owner.query(
    `SELECT (SELECT count(*) FROM companies) AS companies, (SELECT count(*) FROM branches) AS branches,
            (SELECT count(*) FROM daily_metrics) AS metrics, (SELECT count(*) FROM reviews) AS reviews`,
  );
  console.log('Готово:', counts);
} finally {
  await owner.destroy();
}
