import { generateDay } from './generator.js';

describe('генератор статистики имитации геосервиса', () => {
  it('для одной карточки и даты всегда отдаёт одно и то же', () => {
    expect(generateDay('ext-1', '2026-03-01')).toEqual(
      generateDay('ext-1', '2026-03-01'),
    );
  });

  it('разные карточки и даты дают разные значения', () => {
    const a = generateDay('ext-1', '2026-03-01');
    expect(generateDay('ext-2', '2026-03-01').views).not.toBe(a.views);
    expect(generateDay('ext-1', '2026-03-02').views).not.toBe(a.views);
  });

  it('значения — неотрицательные целые, действия не превышают просмотры', () => {
    for (let day = 1; day <= 28; day++) {
      const d = generateDay('ext-9', `2026-02-${String(day).padStart(2, '0')}`);
      for (const value of [d.views, d.siteClicks, d.calls, d.routes]) {
        expect(Number.isInteger(value) && value >= 0).toBe(true);
      }
      expect(d.siteClicks + d.calls + d.routes).toBeLessThan(d.views);
    }
  });
});
