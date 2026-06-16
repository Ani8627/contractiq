import type { RiskLevel } from './types';

export const riskColor: Record<RiskLevel, string> = {
  low: 'bg-green-100 text-green-800 border border-green-300',
  medium: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  high: 'bg-orange-100 text-orange-800 border border-orange-300',
  critical: 'bg-red-100 text-red-800 border border-red-300',
};

export const riskDotColor: Record<RiskLevel, string> = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

export const riskWeight: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function scoreToLabel(score: number): { label: string; color: string } {
  if (score >= 3.5) return { label: 'Critical', color: 'text-red-700' };
  if (score >= 2.5) return { label: 'High', color: 'text-orange-700' };
  if (score >= 1.5) return { label: 'Medium', color: 'text-yellow-700' };
  return { label: 'Low', color: 'text-green-700' };
}
