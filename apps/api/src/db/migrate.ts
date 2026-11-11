import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source.js';
import { provisionAppRole } from './provision.js';
import { seedDemo } from './seed.js';

/**
 * Разовая подготовка базы перед стартом приложения: миграции, логин приложения
 * и (при SEED_DEMO=true) демо-данные. Подключается владельцем БД — у самого
 * приложения прав на изменение схемы нет.
 */
const { DATABASE_OWNER_URL, DATABASE_URL, SEED_DEMO } = process.env;
if (!DATABASE_OWNER_URL || !DATABASE_URL) {
  throw new Error('Нужны переменные DATABASE_OWNER_URL и DATABASE_URL');
}

const owner = new DataSource(dataSourceOptions(DATABASE_OWNER_URL));
await owner.initialize();
try {
  const applied = await owner.runMigrations();
  console.log(`Миграции: применено ${applied.length}`);
  await provisionAppRole(owner, DATABASE_URL);
  if (SEED_DEMO === 'true') {
    console.log(
      (await seedDemo(owner))
        ? 'Демо-данные загружены'
        : 'Демо-данные пропущены: база уже заполнена',
    );
  }
} finally {
  await owner.destroy();
}
