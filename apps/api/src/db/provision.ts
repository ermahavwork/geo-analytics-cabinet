import type { DataSource } from 'typeorm';

/**
 * Создаёт (или обновляет) логин приложения из DATABASE_URL и включает его в
 * группу app_tenant. Выполняется владельцем БД вместе с миграциями.
 */
export async function provisionAppRole(
  owner: DataSource,
  appDatabaseUrl: string,
): Promise<void> {
  const { username, password } = new URL(appDatabaseUrl);
  const [{ owner: ownerName }] = await owner.query(
    `SELECT current_user AS owner`,
  );
  if (decodeURIComponent(username) === ownerName) {
    throw new Error(
      'DATABASE_URL указывает на владельца базы: под ним Row-Level Security не действует. Нужен отдельный логин приложения.',
    );
  }
  const [{ exists }] = await owner.query(
    `SELECT EXISTS (SELECT FROM pg_roles WHERE rolname = $1) AS exists`,
    [decodeURIComponent(username)],
  );
  const [{ statement }] = await owner.query(
    `SELECT format('%s ROLE %I LOGIN PASSWORD %L', $1::text, $2::text, $3::text) AS statement`,
    [
      exists ? 'ALTER' : 'CREATE',
      decodeURIComponent(username),
      decodeURIComponent(password),
    ],
  );
  await owner.query(statement);
  const [{ grant }] = await owner.query(
    `SELECT format('GRANT app_tenant TO %I', $1::text) AS grant`,
    [decodeURIComponent(username)],
  );
  await owner.query(grant);
}
