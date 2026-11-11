import { setTimeout as sleep } from 'node:timers/promises';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { CONFIG, type Config } from '../config.js';

const count = z.number().int().min(0);
const responseSchema = z.object({
  days: z
    .array(
      z.object({
        date: z.iso.date(),
        views: count,
        siteClicks: count,
        calls: count,
        routes: count,
      }),
    )
    .max(400),
});
export type GeoDay = z.infer<typeof responseSchema>['days'][number];

const MAX_ATTEMPTS = 4;
const RETRY_DELAY_MS = 200;
const TIMEOUT_MS = 5_000;

/** Ответ, который бессмысленно запрашивать повторно (не тот ключ, нет карточки, не тот формат). */
class PermanentError extends Error {}

@Injectable()
export class GeoClient {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  /**
   * Статистика карточки за период. Сетевые сбои, таймауты, 5xx и 429 повторяются
   * с растущей паузой; ответ проверяется по схеме, прежде чем попасть в базу.
   */
  async insights(
    externalId: string,
    from: string,
    to: string,
  ): Promise<GeoDay[]> {
    const url = `${this.config.GEO_API_URL}/locations/${encodeURIComponent(externalId)}/insights?from=${from}&to=${to}`;
    for (let attempt = 1; ; attempt++) {
      try {
        // Источнику не доверяем: дни вне запрошенного периода отбрасываются,
        // из повторов одной даты остаётся последний.
        const days = new Map<string, GeoDay>();
        for (const day of await this.request(url)) {
          if (day.date >= from && day.date <= to) days.set(day.date, day);
        }
        return [...days.values()];
      } catch (error) {
        if (error instanceof PermanentError || attempt === MAX_ATTEMPTS) {
          throw error;
        }
        await sleep(RETRY_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }

  private async request(url: string): Promise<GeoDay[]> {
    const response = await fetch(url, {
      headers: { 'x-api-key': this.config.GEO_API_KEY },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Ключ не должен уйти по перенаправлению на другой адрес.
      redirect: 'error',
    });
    if (response.status >= 500 || response.status === 429) {
      throw new Error(`источник ответил ${response.status}`);
    }
    if (!response.ok) {
      throw new PermanentError(`источник ответил ${response.status}`);
    }
    // Не-JSON — ответ не по формату; обрыв или таймаут на теле — сбой сети, его повторяем.
    const body = await response.json().catch((error) => {
      if (error instanceof SyntaxError) return null;
      throw error;
    });
    const parsed = responseSchema.safeParse(body);
    if (!parsed.success) {
      throw new PermanentError('ответ источника не соответствует формату');
    }
    return parsed.data.days;
  }
}
