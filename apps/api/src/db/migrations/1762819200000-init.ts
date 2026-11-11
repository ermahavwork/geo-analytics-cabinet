import type { MigrationInterface, QueryRunner } from 'typeorm';

// Настройки обёрнуты в подзапросы, чтобы PostgreSQL вычислял их один раз на
// запрос, а не на каждой строке. После транзакции настройка остаётся пустой
// строкой, поэтому nullif: без контекста условие ложно и строк не видно.
const IS_ADMIN = `(SELECT current_setting('app.is_admin', true)) = 'true'`;
const OWN_COMPANY = `(SELECT nullif(current_setting('app.company_id', true), '')::uuid)`;
const TENANT_POLICY = `(${IS_ADMIN} OR company_id = ${OWN_COMPANY})`;

export class Init1762819200000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE user_role AS ENUM ('admin', 'client')`);
    await q.query(
      `CREATE TYPE review_status AS ENUM ('new', 'in_progress', 'processed')`,
    );
    await q.query(
      `CREATE TYPE sync_status AS ENUM ('running', 'success', 'partial', 'failed')`,
    );

    await q.query(`
      CREATE TABLE companies (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);

    await q.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        email text NOT NULL,
        password_hash text NOT NULL,
        full_name text NOT NULL,
        role user_role NOT NULL,
        company_id uuid REFERENCES companies (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT users_role_company_check
          CHECK ((role = 'admin') = (company_id IS NULL))
      )`);
    await q.query(
      `CREATE UNIQUE INDEX users_email_key ON users (lower(email))`,
    );

    await q.query(`
      CREATE TABLE branches (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        company_id uuid NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
        name text NOT NULL,
        city text NOT NULL,
        address text NOT NULL,
        external_id text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (id, company_id)
      )`);
    await q.query(
      `CREATE INDEX branches_company_name_idx ON branches (company_id, name)`,
    );

    // company_id продублирован из филиала: по нему работают RLS и индекс периода,
    // а составной внешний ключ не даёт ему разойтись с филиалом.
    await q.query(`
      CREATE TABLE daily_metrics (
        branch_id uuid NOT NULL,
        date date NOT NULL,
        company_id uuid NOT NULL,
        views integer NOT NULL CHECK (views >= 0),
        site_clicks integer NOT NULL CHECK (site_clicks >= 0),
        calls integer NOT NULL CHECK (calls >= 0),
        routes integer NOT NULL CHECK (routes >= 0),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (branch_id, date),
        FOREIGN KEY (branch_id, company_id)
          REFERENCES branches (id, company_id) ON DELETE CASCADE
      )`);
    await q.query(
      `CREATE INDEX daily_metrics_company_date_idx ON daily_metrics (company_id, date)`,
    );
    await q.query(
      `CREATE INDEX daily_metrics_date_idx ON daily_metrics (date)`,
    );

    await q.query(`
      CREATE TABLE reviews (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        branch_id uuid NOT NULL,
        company_id uuid NOT NULL,
        external_id text NOT NULL UNIQUE,
        author_name text NOT NULL,
        rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
        text text NOT NULL,
        status review_status NOT NULL DEFAULT 'new',
        published_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY (branch_id, company_id)
          REFERENCES branches (id, company_id) ON DELETE CASCADE
      )`);
    await q.query(
      `CREATE INDEX reviews_company_published_idx ON reviews (company_id, published_at DESC)`,
    );
    await q.query(
      `CREATE INDEX reviews_branch_published_idx ON reviews (branch_id, published_at DESC)`,
    );
    await q.query(
      `CREATE INDEX reviews_published_idx ON reviews (published_at DESC)`,
    );

    await q.query(`
      CREATE TABLE sync_runs (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        idempotency_key text UNIQUE,
        requested_by uuid REFERENCES users (id) ON DELETE SET NULL,
        date_from date NOT NULL,
        date_to date NOT NULL,
        status sync_status NOT NULL DEFAULT 'running',
        branches_total integer NOT NULL DEFAULT 0,
        branches_failed integer NOT NULL DEFAULT 0,
        rows_received integer NOT NULL DEFAULT 0,
        rows_changed integer NOT NULL DEFAULT 0,
        error text,
        started_at timestamptz NOT NULL DEFAULT now(),
        finished_at timestamptz
      )`);
    // Одновременно может идти только одна синхронизация — гарантирует сама БД.
    await q.query(
      `CREATE UNIQUE INDEX sync_runs_single_running_idx ON sync_runs ((true)) WHERE status = 'running'`,
    );

    // Второй слой изоляции. Приложение подключается ролью из группы app_tenant:
    // она не владеет таблицами и не может обойти политики, поэтому без контекста
    // пользователя (см. TenantDb) таблицы с данными компаний возвращают 0 строк.
    // Роль общая на кластер, поэтому создаётся, только если её ещё нет.
    await q.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_tenant') THEN
          CREATE ROLE app_tenant NOLOGIN;
        END IF;
      END $$`);
    await q.query(`GRANT SELECT ON users, companies, branches TO app_tenant`);
    await q.query(
      `GRANT SELECT, INSERT, UPDATE ON daily_metrics, sync_runs TO app_tenant`,
    );
    await q.query(`GRANT SELECT, UPDATE ON reviews TO app_tenant`);

    await q.query(`ALTER TABLE companies ENABLE ROW LEVEL SECURITY`);
    await q.query(`
      CREATE POLICY tenant_isolation ON companies TO app_tenant
        USING (${IS_ADMIN} OR id = ${OWN_COMPANY})`);
    for (const table of ['branches', 'daily_metrics', 'reviews']) {
      await q.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q.query(
        `CREATE POLICY tenant_isolation ON ${table} TO app_tenant USING ${TENANT_POLICY} WITH CHECK ${TENANT_POLICY}`,
      );
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DROP TABLE sync_runs, reviews, daily_metrics, branches, users, companies`,
    );
    await q.query(`DROP TYPE sync_status, review_status, user_role`);
  }
}
