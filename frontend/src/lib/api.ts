/**
 * データ取得の窓口。画面はここだけを呼びます。
 *
 * 今はバックエンドがないので、ダミーデータ（src/mocks/seed.ts）を返し、
 * 申請の入力内容はブラウザの localStorage に保存しています。
 * バックエンドができたら、このファイルの中身を API 呼び出しに差し替えます
 * （画面側は変えません）。そのとき src/mocks は消します。
 */
import { seedMeti, seedPeers, seedStrategy } from '@/mocks/seed';
import type { MetiData, PeerData, StrategyData } from './types';

/** データの形を変えたら番号を上げる（古い保存内容を読まないため） */
const STORAGE_KEY = 'michisuji.strategy.v1';

/** 自社の申請内容（戦略マップの元データ） */
export async function fetchStrategy(): Promise<StrategyData> {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as StrategyData;
  } catch {
    // 保存内容が読めないときはダミーデータに戻す
  }
  return structuredClone(seedStrategy);
}

/** 申請内容の保存 */
export async function saveStrategy(data: StrategyData): Promise<void> {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 保存できなくても画面は動かす
  }
}

/** 他社の事業（匿名）と平均 */
export async function fetchPeers(): Promise<PeerData> {
  return seedPeers;
}

/** 経産省の画面の集計 */
export async function fetchMetiSummary(): Promise<MetiData> {
  return seedMeti;
}
