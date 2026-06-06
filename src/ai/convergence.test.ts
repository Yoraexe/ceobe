import { describe, it, expect, beforeEach } from 'vitest';
import { computeChangedDocs } from './supervisor';

describe('Hash Convergence Guard', () => {
  beforeEach(() => {
    // Reset snapshots map before each test
    computeChangedDocs({}, true);
  });

  it('Test 1: Initial load should mark all docs as changed', () => {
    const docs = { brd: 'v1', design: 'v1' };
    const changed = computeChangedDocs(docs);
    expect(changed).toEqual(['brd', 'design']);
  });

  it('Test 2: No changes should return empty array (convergence)', () => {
    const docs = { brd: 'v1', design: 'v1' };
    computeChangedDocs(docs); // Iteration 1
    
    // Iteration 2: No changes
    const changed = computeChangedDocs(docs);
    expect(changed).toEqual([]);
  });

  it('Test 3: Hallucination Guard (QA hallucinated, Planner did not change anything)', () => {
    const docs = { brd: 'v1', design: 'v1' };
    computeChangedDocs(docs); // Iteration 1
    
    // QA hallucinated that 'brd' was bad, but planner produced exact same text
    const newDocs = { brd: 'v1', design: 'v1' };
    const changed = computeChangedDocs(newDocs);
    expect(changed).toEqual([]); // Loop will break!
  });

  it('Test 4: Legitimate cascade update', () => {
    const docs = { brd: 'v1', design: 'v1' };
    computeChangedDocs(docs); // Iteration 1
    
    // Iteration 2: User or planner changes design
    const newDocs = { brd: 'v1', design: 'v2' };
    const changed = computeChangedDocs(newDocs);
    expect(changed).toEqual(['design']);
    
    // Iteration 3: QA says BRD is out of sync, planner updates BRD
    const finalDocs = { brd: 'v2', design: 'v2' };
    const finalChanged = computeChangedDocs(finalDocs);
    expect(finalChanged).toEqual(['brd']);
  });
});
