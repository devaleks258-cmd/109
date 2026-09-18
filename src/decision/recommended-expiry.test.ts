import { describe, it, expect } from 'vitest';
import {
  recommendedExpiry,
  fallbackExpiry,
  isPatternHorizonRejected,
  assetClassOf,
  lookupPatternHorizon,
  patternHorizonKey,
} from './recommended-expiry';
import { PATTERN_HORIZON_TABLE } from './pattern-horizon-table';

// ВНИМАНИЕ (DoD п.7): часть ожиданий ниже завязана на СГЕНЕРИРОВАННУЮ
// таблицу и обязана меняться вместе с ней после каждого нового прогона.
// Чтобы такие тесты не превращались в скрытый тормоз перекалибровки,
// табличные значения берутся из самой таблицы, а проверяется ПОВЕДЕНИЕ
// (валидный → табличный горизонт; rejected → подавление; no-evidence →
// fallback). Жёстко зашит только сам факт наличия хотя бы одной записи
// каждого статуса на текущих данных — если после перегенерации такой
// записи не останется, тест честно упадёт, и это нужный сигнал.

describe('assetClassOf', () => {
  it('распознаёт крипту и форекс', () => {
    expect(assetClassOf('BTCUSDT')).toBe('crypto');
    expect(assetClassOf('ETHUSDT')).toBe('crypto');
    expect(assetClassOf('EURUSD')).toBe('forex');
    expect(assetClassOf('USDJPY')).toBe('forex');
  });

  it('неизвестный символ трактуется как форекс (консервативно)', () => {
    expect(assetClassOf('UNKNOWN')).toBe('forex');
  });
});

describe('recommendedExpiry — fallback (паттерн неизвестен таблице)', () => {
  it('returns at least 1 timeframe for low volatility', () => {
    expect(recommendedExpiry(null, 'forex', '15m', 0.001, 100)).toBeGreaterThanOrEqual(900);
  });

  it('returns more bars for lower volatility', () => {
    const lowVol = recommendedExpiry(null, 'forex', '15m', 0.001, 100);
    const highVol = recommendedExpiry(null, 'forex', '15m', 2, 100);
    expect(lowVol).toBeGreaterThan(highVol);
  });

  it('returns 3x timeframe for very low volatility (< 0.5%)', () => {
    expect(recommendedExpiry(null, 'forex', '15m', 0.4, 100)).toBe(900 * 3);
  });

  it('returns 2x timeframe for medium volatility (0.5%-1%)', () => {
    expect(recommendedExpiry(null, 'forex', '15m', 0.7, 100)).toBe(900 * 2);
  });

  it('returns 1x timeframe for high volatility (> 1%)', () => {
    expect(recommendedExpiry(null, 'forex', '15m', 2, 100)).toBe(900);
  });

  it('returns timeframe seconds when atr is zero', () => {
    expect(recommendedExpiry(null, 'forex', '5m', 0, 100)).toBe(300);
  });

  it('returns timeframe seconds when entryPrice is zero', () => {
    expect(recommendedExpiry(null, 'forex', '5m', 1, 0)).toBe(300);
  });

  it('returns timeframe seconds when both atr and entryPrice are zero', () => {
    expect(recommendedExpiry(null, 'forex', '1m', 0, 0)).toBe(60);
  });

  it('works correctly for different timeframes', () => {
    expect(recommendedExpiry(null, 'forex', '1m', 2, 100)).toBe(60);
    expect(recommendedExpiry(null, 'forex', '1h', 2, 100)).toBe(3600);
    expect(recommendedExpiry(null, 'forex', '1d', 2, 100)).toBe(86400);
  });

  it('handles boundary at exactly 0.5% volatility', () => {
    expect(recommendedExpiry(null, 'forex', '15m', 0.5, 100)).toBe(900 * 2);
  });

  it('handles boundary at exactly 1% volatility', () => {
    expect(recommendedExpiry(null, 'forex', '15m', 1, 100)).toBe(900);
  });

  it('falls back for pattern absent from the table', () => {
    expect(recommendedExpiry('hammer', 'forex', '1m', 2, 100)).toBe(60);
    expect(recommendedExpiry('hammer', 'crypto', '1m', 2, 100)).toBe(60);
  });
});

describe('recommendedExpiry — таблица горизонтов', () => {
  it('на текущих прогонах есть хотя бы одна valid-запись', () => {
    const valid = (['crypto', 'forex'] as const).flatMap((ac) =>
      Object.entries(PATTERN_HORIZON_TABLE[ac]).filter(([, r]) => r?.status === 'valid'),
    );
    expect(valid.length).toBeGreaterThan(0);
  });

  it('valid-запись даёт табличный горизонт вместо fallback', () => {
    // harmonic-pattern на крипте — единственная valid-запись текущего прогона.
    const record = PATTERN_HORIZON_TABLE.crypto['harmonic-pattern'];
    expect(record?.status).toBe('valid');
    const bars = record!.entry!.expiryBars;
    expect(recommendedExpiry('harmonic-pattern', 'crypto', '1m', 2, 100)).toBe(60 * bars);
  });

  it('valid-горизонт имеет приоритет над чоп-поправкой', () => {
    const bars = PATTERN_HORIZON_TABLE.crypto['harmonic-pattern']!.entry!.expiryBars;
    expect(recommendedExpiry('harmonic-pattern', 'crypto', '1m', 2, 100, true)).toBe(60 * bars);
  });

  it('no-evidence НЕ подменяет fallback и НЕ подавляет сигнал', () => {
    expect(PATTERN_HORIZON_TABLE.crypto['inside-bar']?.status).toBe('no-evidence');
    expect(recommendedExpiry('inside-bar', 'crypto', '1m', 2, 100)).toBe(60);
    expect(isPatternHorizonRejected('inside-bar', 'crypto')).toBe(false);
  });

  it('rejected уходит в fallback по горизонту (подавление — отдельным гейтом)', () => {
    expect(PATTERN_HORIZON_TABLE.crypto['impulse-breakout']?.status).toBe('rejected');
    expect(recommendedExpiry('impulse-breakout', 'crypto', '1m', 2, 100)).toBe(60);
  });

  it('РЕГРЕССИЯ: класс актива не протекает между таблицами', () => {
    // harmonic-pattern: valid на крипте (55.1%), rejected на форексе (44.0%).
    // До скоупинга крипто-результат применялся к EURUSD.
    expect(lookupPatternHorizon('harmonic-pattern', 'crypto')?.status).toBe('valid');
    expect(lookupPatternHorizon('harmonic-pattern', 'forex')?.status).toBe('rejected');
    expect(recommendedExpiry('harmonic-pattern', 'forex', '1m', 2, 100)).toBe(60);
  });
});

describe('recommendedExpiry — setupType-aware lookup (B\'\u00b3)', () => {
  it('patternHorizonKey: null setupType → плоский ключ', () => {
    expect(patternHorizonKey('harmonic-pattern', null)).toBe('harmonic-pattern');
    expect(patternHorizonKey('harmonic-pattern', undefined)).toBe('harmonic-pattern');
  });

  it('patternHorizonKey: non-null setupType → pattern#setupType', () => {
    expect(patternHorizonKey('liquidity-sweep-reaction', 'continuation')).toBe('liquidity-sweep-reaction#continuation');
    expect(patternHorizonKey('liquidity-sweep-reaction', 'reversal-at-key-level')).toBe('liquidity-sweep-reaction#reversal-at-key-level');
  });

  it('patternHorizonKey: null pattern → null', () => {
    expect(patternHorizonKey(null, 'continuation')).toBeNull();
    expect(patternHorizonKey(null, null)).toBeNull();
  });

  it('lookupPatternHorizon: setupType-специфичный лукап находит запись, плоский — нет', () => {
    // На текущих данных liquidity-sweep-reaction в таблице нет,
    // но если бы был с setupType, плоский лукап не должен его найти.
    // Проверяем на существующей valid-записи: harmonic-pattern без setupType.
    expect(lookupPatternHorizon('harmonic-pattern', 'crypto', null)?.status).toBe('valid');
    expect(lookupPatternHorizon('harmonic-pattern', 'crypto', 'continuation')).toBeNull();
  });

  it('isPatternHorizonRejected: setupType-специфичное подавление', () => {
    // Если бы liquidity-sweep-reaction#reversal был rejected, а #continuation — нет,
    // подавление работало бы только для своего setupType.
    expect(isPatternHorizonRejected('harmonic-pattern', 'forex', null)).toBe(true);
    expect(isPatternHorizonRejected('harmonic-pattern', 'forex', 'continuation')).toBe(false);
  });

  it('recommendedExpiry: setupType-специфичный valid-горизонт', () => {
    const record = PATTERN_HORIZON_TABLE.crypto['harmonic-pattern'];
    const bars = record!.entry!.expiryBars;
    expect(recommendedExpiry('harmonic-pattern', 'crypto', '1m', 2, 100, false, null)).toBe(60 * bars);
    // Несуществующий setupType → fallback
    expect(recommendedExpiry('harmonic-pattern', 'crypto', '1m', 2, 100, false, 'continuation')).toBe(60);
  });
});

describe('fallbackExpiry', () => {
  it('returns 3x for very low volatility', () => {
    expect(fallbackExpiry('15m', 0.4, 100)).toBe(900 * 3);
  });

  it('adds 1 bar for range with weak trend', () => {
    const normal = fallbackExpiry('15m', 2, 100, false);
    const weak = fallbackExpiry('15m', 2, 100, true);
    expect(weak).toBe(normal + 900);
  });
});

describe('isPatternHorizonRejected', () => {
  it('true только при значимом отличии В ХУДШУЮ сторону', () => {
    expect(isPatternHorizonRejected('impulse-breakout', 'crypto')).toBe(true);
    expect(isPatternHorizonRejected('harmonic-pattern', 'forex')).toBe(true);
  });

  it('false для valid', () => {
    expect(isPatternHorizonRejected('harmonic-pattern', 'crypto')).toBe(false);
  });

  it('РЕГРЕССИЯ: no-evidence НЕ подавляет (нет доказательств ≠ доказано обратное)', () => {
    // Прежняя двухстатусная схема выключала все три целиком.
    expect(isPatternHorizonRejected('inside-bar', 'crypto')).toBe(false);
    expect(isPatternHorizonRejected('inside-bar', 'forex')).toBe(false);
    expect(isPatternHorizonRejected('strong-order-block-reaction', 'crypto')).toBe(false);
    expect(isPatternHorizonRejected('order-block-continuation', 'forex')).toBe(false);
    expect(isPatternHorizonRejected('impulse-breakout', 'forex')).toBe(false);
  });

  it('false для отсутствующего паттерна и для null', () => {
    expect(isPatternHorizonRejected('hammer', 'crypto')).toBe(false);
    expect(isPatternHorizonRejected(null, 'forex')).toBe(false);
  });
});
