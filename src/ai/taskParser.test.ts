import { describe, it, expect } from 'vitest';
import { parseTaskWaves } from './taskParser';

describe('taskParser', () => {
  it('should parse waves based on heuristics from task format', () => {
    const markdown = `
- [ ] Task 1: Setup database schema
- [ ] Task 2: Build UI component
`;
    const result = parseTaskWaves(markdown);

    expect(result).toHaveLength(2);
    expect(result[0].wave).toBe(0);
    expect(result[0].tasks[0].title).toBe('Task 1: Setup database schema');
    expect(result[1].wave).toBe(2);
    expect(result[1].tasks[0].title).toBe('Task 2: Build UI component');
  });

  it('should not split markdown code blocks across triple backticks', () => {
    const markdown = `
### Task 1: Create Helper
\`\`\`ts
// Code snippet with list inside:
- [ ] item inside code block
\`\`\`

### Task 2: Write documentation
Create README.md
`;
    const result = parseTaskWaves(markdown);
    expect(result.length).toBeGreaterThan(0);
    // Task 1 code block should remain intact
    expect(result[0].tasks[0].content).toContain('item inside code block');
  });

  it('should place documentation / unit test tasks into the final parallel wave', () => {
    const markdown = `
- [ ] Task 1: Write unit tests for API
`;
    const result = parseTaskWaves(markdown);
    expect(result[0].wave).toBe(3);
  });
});
