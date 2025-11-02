# Upstream Sync Documentation

This document tracks the synchronization history between Foragen CLI fork and the upstream QwenLM/qwen-code repository.

## Remote Configuration

```bash
# Your fork (main development)
origin: https://github.com/jeffreysblake/foragen-cli.git

# Upstream repository
qwen-upstream: https://github.com/QwenLM/qwen-code.git
```

## Sync Workflow

### 1. Initial Setup (Completed)

```bash
# Configure remotes
git remote rename origin qwen-upstream
git remote add origin https://github.com/jeffreysblake/foragen-cli.git

# Fetch upstream
git fetch qwen-upstream
```

### 2. Regular Sync Process

```bash
# 1. Fetch latest from upstream
git fetch qwen-upstream

# 2. Checkout main branch
git checkout main

# 3. Create a new branch for the merge
git checkout -b sync/upstream-YYYYMMDD

# 4. Merge upstream changes
git merge qwen-upstream/main

# 5. Resolve conflicts
# - Keep our customizations
# - Incorporate upstream improvements
# - Document conflicts below

# 6. Run rebranding script
./scripts/rebrand-to-fora.sh

# 7. Test everything
npm install
npm run build
npm test

# 8. Merge to main
git checkout main
git merge sync/upstream-YYYYMMDD

# 9. Push changes
git push origin main
```

## Sync History

### 2025-11-02: Initial Fork and Rebranding

- **Upstream Commit**: d6795c0e (fixed tool calling for background parameters)
- **Action**: Complete rebranding from Qwen to Fora
- **Changes**:
  - 204 files updated with new branding
  - Package names changed to @jeffreysblake/foragen-\*
  - Binary renamed from `qwen` to `fora`
  - Configuration directory changed to `~/.fora/`
- **Conflicts**: None (initial fork)
- **Notes**: First major customization of the fork

## Conflict Resolution Guidelines

When merging from upstream, follow these principles:

### Always Keep Our Changes

1. **Package Names**: Keep @jeffreysblake/foragen-\* namespace
2. **Binary Name**: Keep `fora` as the command
3. **Branding**: Keep "Foragen CLI" naming
4. **Config Directory**: Keep `~/.fora/` path
5. **Docker Images**: Keep local image references

### Accept Upstream Changes For

1. **Bug Fixes**: Accept all bug fixes from upstream
2. **New Features**: Incorporate new features when compatible
3. **Performance Improvements**: Always accept optimizations
4. **Security Updates**: Priority acceptance for security fixes
5. **Documentation**: Merge technical documentation improvements

### Typical Conflict Areas

- `package.json` files (keep our package names)
- Import statements (keep our package references)
- Class/function names containing "Qwen" (keep "Fora")
- Configuration paths (keep `.fora` directory)
- Docker image references (keep local builds)

## Automated Helpers

### Scripts Available

1. **rebrand-to-fora.sh**: Re-applies branding after merge
2. **verify-rebranding.sh**: Checks for missed qwen references
3. **update-imports.sh**: Updates import statements

### Post-Merge Checklist

- [ ] Run `./scripts/verify-rebranding.sh` to check for qwen references
- [ ] Run `npm install` to update dependencies
- [ ] Run `npm run build` to verify build
- [ ] Run `npm test` to ensure tests pass
- [ ] Test CLI with `npm start`
- [ ] Build Docker image if needed
- [ ] Update this document with merge details

## Upstream Monitoring

### Key Areas to Watch

- Authentication changes (OAuth flow)
- Model configuration updates
- Tool system enhancements
- MCP server improvements
- Security fixes

### Upstream Branches of Interest

- `main` - Primary development branch
- `release/*` - Stable release branches
- Feature branches for major updates

## Cherry-Pick Strategy

For selective updates:

```bash
# Cherry-pick specific commits
git cherry-pick <commit-hash>

# Run rebranding on changed files
./scripts/update-imports.sh

# Test and verify
npm test
```

## Rollback Procedure

If sync causes issues:

```bash
# Revert to previous state
git reset --hard HEAD~1

# Or revert specific merge
git revert -m 1 <merge-commit>
```

## Notes

- Always create a backup branch before major syncs
- Document significant conflicts in this file
- Run comprehensive tests after each sync
- Keep CUSTOMIZATIONS.md updated with preserved changes
