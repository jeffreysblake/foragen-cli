# Pre-Merge Validation Hook

## Overview

This document explores options for implementing pre-merge validation to check both branches for errors **before** completing a merge, reducing post-merge test failures.

## The Problem

**Current workflow**:

1. `git merge feature-branch`
2. Merge completes
3. Run tests → 99 failures discovered
4. Must recover using git-merge-recovery skill

**Desired workflow**:

1. `git merge feature-branch`
2. **Hook checks both branches for errors** ✨
3. Warns: "Main has 5 errors, feature has 12 errors, expect merge complexity"
4. Merge completes with awareness
5. Much fewer unexpected failures

## Available Git Hook: `pre-merge-commit`

Git provides a `pre-merge-commit` hook that runs **before finalizing a merge commit**.

**Location**: `.git/hooks/pre-merge-commit` (or `.husky/pre-merge-commit` with husky)

**Timing**:

- Runs after merge resolution, before commit
- Can abort merge by exiting with non-zero status
- Has access to both branches via git refs

**Sample from git**:

```bash
#!/bin/sh
# .git/hooks/pre-merge-commit.sample
# Called by "git merge" with no arguments.
# Exit non-zero to stop merge commit.

. git-sh-setup
test -x "$GIT_DIR/hooks/pre-commit" &&
        exec "$GIT_DIR/hooks/pre-commit"
```

## Implementation Options

### Option 1: Lightweight Check (Recommended)

**What**: Check for obvious red flags without running full test suite

**Hook**: `.husky/pre-merge-commit`

```bash
#!/bin/sh

echo "🔍 Pre-merge validation..."

# Get merge info
MERGE_HEAD=$(git rev-parse MERGE_HEAD 2>/dev/null)
if [ -z "$MERGE_HEAD" ]; then
  echo "Not a merge, skipping validation"
  exit 0
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
MERGE_BRANCH=$(git name-rev --name-only $MERGE_HEAD)

echo "Merging $MERGE_BRANCH into $CURRENT_BRANCH"

# Quick checks (fast, <5 seconds)
echo "Running quick validation..."

# 1. Check for TypeScript errors on current branch
echo "Checking $CURRENT_BRANCH for TypeScript errors..."
CURRENT_TS_ERRORS=$(npm run typecheck 2>&1 | grep -c "error TS" || echo "0")

# 2. Check for TypeScript errors on merge branch (in temp worktree)
echo "Checking $MERGE_BRANCH for TypeScript errors..."
TEMP_DIR=$(mktemp -d)
git worktree add "$TEMP_DIR" "$MERGE_HEAD" --detach > /dev/null 2>&1
cd "$TEMP_DIR"
MERGE_TS_ERRORS=$(npm run typecheck 2>&1 | grep -c "error TS" || echo "0")
cd - > /dev/null
git worktree remove "$TEMP_DIR" --force > /dev/null 2>&1

# Report findings
echo ""
echo "======================================================"
echo "Pre-Merge Validation Results"
echo "======================================================"
echo "$CURRENT_BRANCH TypeScript errors: $CURRENT_TS_ERRORS"
echo "$MERGE_BRANCH TypeScript errors: $MERGE_TS_ERRORS"

TOTAL_ERRORS=$((CURRENT_TS_ERRORS + MERGE_TS_ERRORS))

if [ "$TOTAL_ERRORS" -gt 20 ]; then
  echo ""
  echo "⚠️  WARNING: High error count detected ($TOTAL_ERRORS total)"
  echo "   This merge may require significant recovery work."
  echo "   Consider:"
  echo "   - Fixing errors on individual branches first"
  echo "   - Using git-merge-recovery skill after merge"
  echo "   - Reviewing merge strategy"
  echo ""
  echo "Continue with merge? (Ctrl+C to abort, Enter to continue)"
  read -r
fi

echo "======================================================"
echo "✓ Pre-merge validation complete"
echo "======================================================"

exit 0
```

**Pros**:

- ✅ Fast (<10 seconds)
- ✅ Catches TypeScript errors early
- ✅ Non-blocking (warns but doesn't abort)
- ✅ Works with husky

**Cons**:

- ❌ Doesn't run full test suite (too slow)
- ❌ May miss runtime errors

### Option 2: Full Test Check (Thorough but Slow)

**What**: Run tests on both branches before merging

**Hook**: `.husky/pre-merge-commit`

```bash
#!/bin/sh

echo "🔍 Pre-merge test validation (this may take a while)..."

MERGE_HEAD=$(git rev-parse MERGE_HEAD 2>/dev/null)
if [ -z "$MERGE_HEAD" ]; then
  exit 0
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
MERGE_BRANCH=$(git name-rev --name-only $MERGE_HEAD)

echo "Testing $CURRENT_BRANCH..."
npm test -- --reporter=summary > /tmp/current-tests.txt 2>&1
CURRENT_FAILURES=$(grep -oP '\d+(?= failed)' /tmp/current-tests.txt || echo "0")

echo "Testing $MERGE_BRANCH..."
TEMP_DIR=$(mktemp -d)
git worktree add "$TEMP_DIR" "$MERGE_HEAD" --detach > /dev/null 2>&1
cd "$TEMP_DIR"
npm ci > /dev/null 2>&1
npm test -- --reporter=summary > /tmp/merge-tests.txt 2>&1
MERGE_FAILURES=$(grep -oP '\d+(?= failed)' /tmp/merge-tests.txt || echo "0")
cd - > /dev/null
git worktree remove "$TEMP_DIR" --force > /dev/null 2>&1

echo ""
echo "======================================================"
echo "Pre-Merge Test Results"
echo "======================================================"
echo "$CURRENT_BRANCH failures: $CURRENT_FAILURES"
echo "$MERGE_BRANCH failures: $MERGE_FAILURES"
echo "Expected merge complexity: $(( CURRENT_FAILURES + MERGE_FAILURES ))"
echo "======================================================"

TOTAL=$((CURRENT_FAILURES + MERGE_FAILURES))

if [ "$TOTAL" -gt 20 ]; then
  echo ""
  echo "⚠️  HIGH COMPLEXITY MERGE DETECTED"
  echo "   Consider using git-merge-recovery skill after merge"
  echo ""
fi

exit 0
```

**Pros**:

- ✅ Comprehensive test coverage
- ✅ Catches runtime errors
- ✅ Accurate failure prediction

**Cons**:

- ❌ Very slow (2-5 minutes)
- ❌ Requires npm ci on temp branch
- ❌ May time out on large test suites
- ❌ Frustrating developer experience

### Option 3: CI-Based Check (Best Practice)

**What**: Use GitHub Actions / CI to test branches before merge

**Implementation**: GitHub Action that runs on PRs

```yaml
# .github/workflows/pre-merge-check.yml
name: Pre-Merge Validation

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  test-both-branches:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout PR branch
        uses: actions/checkout@v4
        with:
          ref: ${{ github.head_ref }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Test PR branch
        run: |
          npm ci
          npm test -- --reporter=summary > pr-results.txt 2>&1 || true
          PR_FAILURES=$(grep -oP '\d+(?= failed)' pr-results.txt || echo "0")
          echo "PR_FAILURES=$PR_FAILURES" >> $GITHUB_ENV

      - name: Checkout base branch
        uses: actions/checkout@v4
        with:
          ref: ${{ github.base_ref }}

      - name: Test base branch
        run: |
          npm ci
          npm test -- --reporter=summary > base-results.txt 2>&1 || true
          BASE_FAILURES=$(grep -oP '\d+(?= failed)' base-results.txt || echo "0")
          echo "BASE_FAILURES=$BASE_FAILURES" >> $GITHUB_ENV

      - name: Report results
        run: |
          echo "### Pre-Merge Test Results" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- Base branch failures: ${{ env.BASE_FAILURES }}" >> $GITHUB_STEP_SUMMARY
          echo "- PR branch failures: ${{ env.PR_FAILURES }}" >> $GITHUB_STEP_SUMMARY
          echo "- Expected complexity: $(( ${{ env.BASE_FAILURES }} + ${{ env.PR_FAILURES }} ))" >> $GITHUB_STEP_SUMMARY

          TOTAL=$(( ${{ env.BASE_FAILURES }} + ${{ env.PR_FAILURES }} ))
          if [ "$TOTAL" -gt 20 ]; then
            echo "" >> $GITHUB_STEP_SUMMARY
            echo "⚠️ **High complexity merge detected ($TOTAL total failures)**" >> $GITHUB_STEP_SUMMARY
            echo "Consider using git-merge-recovery skill after merge" >> $GITHUB_STEP_SUMMARY
          fi
```

**Pros**:

- ✅ Doesn't slow down local workflow
- ✅ Comprehensive testing
- ✅ Visible in PR comments
- ✅ Can enforce merge requirements

**Cons**:

- ❌ Requires CI setup
- ❌ Not available for local merges
- ❌ Slower feedback loop

## Recommended Approach

**For this project**: Use **Option 1 (Lightweight Check)** + **Option 3 (CI)**

### Why This Combination?

1. **Local development** (Option 1):
   - Fast TypeScript check (<10s)
   - Immediate feedback
   - Non-blocking warnings
   - Works offline

2. **Pull requests** (Option 3):
   - Comprehensive test coverage
   - Doesn't block local work
   - Documented in PR
   - Can be required for merge

### Implementation Steps

1. **Add husky hook**:

   ```bash
   # Create .husky/pre-merge-commit
   cat > .husky/pre-merge-commit << 'EOF'
   #!/bin/sh
   . "$(dirname "$0")/_/husky.sh"

   # Run lightweight pre-merge check
   node scripts/pre-merge-check.js
   EOF

   chmod +x .husky/pre-merge-commit
   ```

2. **Create check script**:

   ```javascript
   // scripts/pre-merge-check.js
   const { execSync } = require('child_process');

   // Detect if this is a merge
   try {
     execSync('git rev-parse MERGE_HEAD', { stdio: 'ignore' });
   } catch {
     // Not a merge, skip
     process.exit(0);
   }

   console.log('🔍 Pre-merge validation...');

   // Run typecheck
   try {
     execSync('npm run typecheck', { stdio: 'inherit' });
     console.log('✓ TypeScript check passed');
   } catch (error) {
     console.warn('⚠️  TypeScript errors detected');
     console.warn('   Review errors before completing merge');
   }

   process.exit(0);
   ```

3. **Add CI workflow** (optional but recommended)

## Integration with git-merge-recovery

The pre-merge-commit hook **complements** the git-merge-recovery skill:

**Pre-merge hook** (preventive):

- Warns about potential complexity
- Catches TypeScript errors early
- Sets expectations

**Git-merge-recovery skill** (reactive):

- Handles actual post-merge failures
- Searches git history for fixes
- Systematic recovery workflow

**Together**:

1. Hook warns: "20 TypeScript errors detected"
2. Developer proceeds with merge (informed)
3. Post-merge: 35 test failures (expected due to warning)
4. Invoke git-merge-recovery skill
5. Search git history, resolve 30 failures quickly
6. Fix remaining 5 true failures

## Trade-offs Summary

| Approach              | Speed    | Coverage    | UX      | CI Integration |
| --------------------- | -------- | ----------- | ------- | -------------- |
| Option 1 (TypeScript) | ⚡️ Fast | ⚠️ Partial  | ✅ Good | ❌ No          |
| Option 2 (Full Tests) | 🐌 Slow  | ✅ Complete | ❌ Poor | ❌ No          |
| Option 3 (CI)         | ⏱️ Async | ✅ Complete | ✅ Good | ✅ Yes         |
| **Hybrid (1+3)**      | ⚡️ Fast | ✅ Complete | ✅ Good | ✅ Yes         |

## Future Enhancements

1. **Smart caching**: Cache test results per commit hash to speed up checks
2. **Affected tests only**: Run only tests affected by merge changes
3. **Parallel testing**: Test both branches in parallel
4. **Historical analysis**: Track merge complexity over time
5. **Auto-recovery**: Automatically apply git history fixes when safe

## References

- Git merge hooks: https://git-scm.com/docs/githooks#_pre_merge_commit
- Husky documentation: https://typicode.github.io/husky/
- Git worktree: https://git-scm.com/docs/git-worktree
- git-merge-recovery skill: `.claude/skills/git-merge-recovery/SKILL.md`

## Quick Start

To enable lightweight pre-merge checking:

```bash
# 1. Create husky hook
cat > .husky/pre-merge-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Quick TypeScript check on merge
MERGE_HEAD=$(git rev-parse MERGE_HEAD 2>/dev/null)
if [ -n "$MERGE_HEAD" ]; then
  echo "🔍 Running pre-merge TypeScript check..."
  npm run typecheck || echo "⚠️  TypeScript errors detected"
fi
EOF

# 2. Make executable
chmod +x .husky/pre-merge-commit

# 3. Test it
git merge --no-ff --no-commit <branch>
# Hook runs, shows TypeScript errors if any
git merge --abort  # Cancel test merge
```

That's it! Now you'll get TypeScript validation before every merge.
