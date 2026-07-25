import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /**
     * Agent worktrees live inside the repo at .claude/worktrees/<name>, and
     * each is a full checkout with its own copy of every test. Left alone,
     * vitest collects both trees and each test runs twice — harmless until a
     * worktree holds stale passing code and masks a real failure in the tree
     * you're actually working in.
     */
    exclude: [...configDefaults.exclude, '**/.claude/worktrees/**'],
  },
});
