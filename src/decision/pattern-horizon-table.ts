// АВТОГЕНЕРИРОВАНО — не редактировать руками.
// Генератор: backtest/generate-pattern-horizon-table.ts
// Перегенерация: npm run backtest:gen-horizon-table
// Сверка в CI:  npm run backtest:gen-horizon-table -- --check
//
// Источники: BTCUSDT-ETHUSDT-1m-walkforward-2026-08-15-2026-09-16, EURUSD-USDJPY-1m-walkforward-2026-08-15-2026-09-16
import type { AssetClass } from '@/types/domain';

export interface PatternHorizonEntry {
  /** Лучший горизонт в барах, выбранный ТОЛЬКО по train/validation. */
  expiryBars: number;
  /** Точность на отложенных test-наблюдениях. */
  accuracy: number;
  testCount: number;
  pValue: number | null;
  significant: boolean;
  passesWilsonGate: boolean;
  sourceRun: string;
}

/**
 * 'valid'       — значимо лучше случайного + Wilson pass → берём expiryBars.
 * 'rejected'    — значимо ХУЖЕ случайного → signal-builder подавляет сигнал.
 * 'no-evidence' — отличие не установлено (или не прошло Wilson) → fallback,
 *                 сигнал НЕ подавляется. Отсутствие записи эквивалентно.
 */
export type PatternHorizonStatus = 'valid' | 'rejected' | 'no-evidence';

export interface PatternHorizonRecord {
  entry: PatternHorizonEntry | null;
  status: PatternHorizonStatus;
  note?: string;
}

export type PatternHorizonTable = Record<AssetClass, Partial<Record<string, PatternHorizonRecord>>>;

export const PATTERN_HORIZON_TABLE: PatternHorizonTable = {
  crypto: {
    "harmonic-pattern": {
      entry: {
        expiryBars: 30,
        accuracy: 0.5507,
        testCount: 670,
        pValue: 0.00959,
        significant: true,
        passesWilsonGate: true,
        sourceRun: "BTCUSDT-ETHUSDT-1m-walkforward-2026-08-15-2026-09-16",
      },
      status: "valid",
    },
    "impulse-breakout": {
      entry: {
        expiryBars: 3,
        accuracy: 0.4635,
        testCount: 1437,
        pValue: 0.00606,
        significant: true,
        passesWilsonGate: false,
        sourceRun: "BTCUSDT-ETHUSDT-1m-walkforward-2026-08-15-2026-09-16",
      },
      status: "rejected",
      note: "significant below baseline",
    },
    "inside-bar": {
      entry: {
        expiryBars: 1,
        accuracy: 0.4989,
        testCount: 6166,
        pValue: 0.8685,
        significant: false,
        passesWilsonGate: false,
        sourceRun: "BTCUSDT-ETHUSDT-1m-walkforward-2026-08-15-2026-09-16",
      },
      status: "no-evidence",
      note: "not distinguishable from baseline",
    },
    "order-block-continuation": {
      entry: {
        expiryBars: 20,
        accuracy: 0.5168,
        testCount: 925,
        pValue: 0.3239,
        significant: false,
        passesWilsonGate: false,
        sourceRun: "BTCUSDT-ETHUSDT-1m-walkforward-2026-08-15-2026-09-16",
      },
      status: "no-evidence",
      note: "not distinguishable from baseline",
    },
    "strong-order-block-reaction": {
      entry: {
        expiryBars: 5,
        accuracy: 0.4993,
        testCount: 3439,
        pValue: 0.9456,
        significant: false,
        passesWilsonGate: false,
        sourceRun: "BTCUSDT-ETHUSDT-1m-walkforward-2026-08-15-2026-09-16",
      },
      status: "no-evidence",
      note: "not distinguishable from baseline",
    },
  },
  forex: {
    "harmonic-pattern": {
      entry: {
        expiryBars: 20,
        accuracy: 0.4398,
        testCount: 407,
        pValue: 0.01724,
        significant: false,
        passesWilsonGate: false,
        sourceRun: "EURUSD-USDJPY-1m-walkforward-2026-08-15-2026-09-16",
      },
      status: "rejected",
      note: "significant below baseline",
    },
    "impulse-breakout": {
      entry: {
        expiryBars: 2,
        accuracy: 0.4864,
        testCount: 1030,
        pValue: 0.4002,
        significant: false,
        passesWilsonGate: false,
        sourceRun: "EURUSD-USDJPY-1m-walkforward-2026-08-15-2026-09-16",
      },
      status: "no-evidence",
      note: "not distinguishable from baseline",
    },
    "inside-bar": {
      entry: {
        expiryBars: 1,
        accuracy: 0.487,
        testCount: 3871,
        pValue: 0.108,
        significant: false,
        passesWilsonGate: false,
        sourceRun: "EURUSD-USDJPY-1m-walkforward-2026-08-15-2026-09-16",
      },
      status: "no-evidence",
      note: "not distinguishable from baseline",
    },
    "order-block-continuation": {
      entry: {
        expiryBars: 10,
        accuracy: 0.4656,
        testCount: 509,
        pValue: 0.1317,
        significant: false,
        passesWilsonGate: false,
        sourceRun: "EURUSD-USDJPY-1m-walkforward-2026-08-15-2026-09-16",
      },
      status: "no-evidence",
      note: "not distinguishable from baseline",
    },
    "strong-order-block-reaction": {
      entry: {
        expiryBars: 30,
        accuracy: 0.4855,
        testCount: 2103,
        pValue: 0.1907,
        significant: false,
        passesWilsonGate: false,
        sourceRun: "EURUSD-USDJPY-1m-walkforward-2026-08-15-2026-09-16",
      },
      status: "no-evidence",
      note: "not distinguishable from baseline",
    },
  },
};
