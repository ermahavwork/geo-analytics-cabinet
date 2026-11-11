import { daysBetween, previousPeriod } from './period.js';

describe('period', () => {
  it('считает дни между датами, в том числе через смену года', () => {
    expect(daysBetween('2026-03-01', '2026-03-01')).toBe(0);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
  });

  it('предыдущий период той же длины примыкает вплотную', () => {
    expect(previousPeriod('2026-03-01', '2026-03-03')).toEqual({
      from: '2026-02-26',
      to: '2026-02-28',
    });
    expect(previousPeriod('2026-03-01', '2026-03-01')).toEqual({
      from: '2026-02-28',
      to: '2026-02-28',
    });
  });

  it('учитывает високосный февраль', () => {
    expect(previousPeriod('2024-03-01', '2024-03-01').to).toBe('2024-02-29');
  });
});
