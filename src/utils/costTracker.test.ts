import { describe, it, expect, beforeEach } from 'vitest';
import { recordUsage, getSessionCost, checkBudget, resetSession, getCostSummary } from './costTracker';

describe('costTracker', () => {
  beforeEach(() => {
    resetSession();
  });

  it('should calculate cost correctly for gemini-2.5-pro', () => {
    recordUsage({ model: 'gemini-2.5-pro', inputTokens: 1_000_000, outputTokens: 1_000_000 });
    // 1.25 + 5.00 = 6.25
    expect(getSessionCost()).toBeCloseTo(6.25);
  });

  it('should calculate cost for open-weights correctly', () => {
    recordUsage({ model: 'deepseek-v3', inputTokens: 1_000_000, outputTokens: 1_000_000 });
    // 0.14 + 0.28 = 0.42
    expect(getSessionCost()).toBeCloseTo(0.42);
  });

  it('should not throw if budget is not exceeded', () => {
    recordUsage({ model: 'gemini-2.5-flash', inputTokens: 1_000_000, outputTokens: 1_000_000 });
    // 0.075 + 0.30 = 0.375
    expect(() => checkBudget(1.0)).not.toThrow();
  });

  it('should throw if budget is exceeded', () => {
    recordUsage({ model: 'claude-3-opus', inputTokens: 1_000_000, outputTokens: 1_000_000 });
    // 15 + 75 = 90
    expect(() => checkBudget(10.0)).toThrow(/BUDGET_EXCEEDED/);
  });

  it('should not throw if budget is <= 0 or invalid', () => {
    recordUsage({ model: 'claude-3-opus', inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(() => checkBudget(0)).not.toThrow();
    expect(() => checkBudget(-10)).not.toThrow();
    expect(() => checkBudget(NaN)).not.toThrow();
  });

  it('should provide summary string', () => {
    recordUsage({ model: 'gpt-4o-mini', inputTokens: 100, outputTokens: 200 });
    const summary = getCostSummary();
    expect(summary).toContain('100 IN, 200 OUT');
  });
});
