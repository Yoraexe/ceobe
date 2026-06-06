import { describe, it, expect } from 'vitest';
import { parseTaskWaves } from './taskParser';

describe('taskParser', () => {
  it('should parse waves based on heuristics from task format', () => {
    const markdown = `
- [ ] Task 1: Setup database schema
- [ ] Task 2: Build UI component
`;
    const result = parseTaskWaves(markdown);
    
    // "database schema" should go to wave 0
    // "UI component" should go to wave 2
    expect(result).toHaveLength(2);
    expect(result[0].wave).toBe(0);
    expect(result[0].tasks).toHaveLength(1);
    expect(result[0].tasks[0].title).toBe('Task 1: Setup database schema');
    
    expect(result[1].wave).toBe(2);
    expect(result[1].tasks).toHaveLength(1);
    expect(result[1].tasks[0].title).toBe('Task 2: Build UI component');
  });
});
