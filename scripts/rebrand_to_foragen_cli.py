#!/usr/bin/env python3
"""
Rebrand qwen-code → foragen-cli

This script performs a complete rebranding from qwen-code to foragen-cli.
It uses a TWO-FLOW approach to handle compound patterns correctly:

FLOW 1: "qwen-code" → "foragen-cli" (compound, handle FIRST)
FLOW 2: "qwen" → "fora" (simple, handle AFTER Flow 1)

Within each flow, replacements go from most specific to least specific,
with explicit case handling to preserve mixed-case identifiers correctly.

IMPORTANT: This script DOES NOT touch Qwen model names:
- Qwen3-Coder (the AI model from Alibaba/QwenLM)
- QwenLM organization references
- Model paths like Qwen/Qwen3-Coder-*
These refer to the actual AI model and should remain unchanged.

Pure Python stdlib - no external dependencies required.
"""

import os
import sys
import re
import argparse
import json
import time
from pathlib import Path
from typing import List, Tuple, Set
import subprocess

# ANSI color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    BOLD = '\033[1m'
    NC = '\033[0m'  # No Color


class RebrandingStats:
    """Track statistics during rebranding."""
    def __init__(self):
        self.files_modified = 0
        self.files_renamed = 0
        self.dirs_renamed = 0
        self.replacements_made = 0
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def add_error(self, context: str, error: str):
        """Add an error to the error list."""
        self.errors.append(f"{context}: {error}")

    def add_warning(self, context: str, warning: str):
        """Add a warning to the warning list."""
        self.warnings.append(f"{context}: {warning}")

    def has_errors(self) -> bool:
        """Check if any errors occurred."""
        return len(self.errors) > 0

    def summary(self):
        result = f"""
Statistics:
  Files modified: {self.files_modified}
  Files renamed: {self.files_renamed}
  Directories renamed: {self.dirs_renamed}
  Total replacements: {self.replacements_made}
"""
        if self.warnings:
            result += f"  Warnings: {len(self.warnings)}\n"
        if self.errors:
            result += f"  Errors: {len(self.errors)}\n"
        return result


class TransactionLog:
    """Log all operations for audit trail and potential rollback."""
    def __init__(self, log_path: Path):
        self.log_path = log_path
        self.operations: List[dict] = []

    def record(self, operation: str, old_path: str, new_path: str, success: bool = True):
        """Record an operation."""
        self.operations.append({
            'timestamp': time.time(),
            'operation': operation,
            'old': str(old_path),
            'new': str(new_path),
            'success': success
        })

    def save(self):
        """Save transaction log to file."""
        try:
            with open(self.log_path, 'w') as f:
                json.dump(self.operations, f, indent=2)
        except Exception as e:
            print(f"{Colors.YELLOW}Warning: Could not save transaction log: {e}{Colors.NC}", file=sys.stderr)

    def load(self) -> List[dict]:
        """Load transaction log from file."""
        if self.log_path.exists():
            try:
                with open(self.log_path) as f:
                    return json.load(f)
            except Exception:
                return []
        return []


class Rebrander:
    """Main rebranding class."""

    def __init__(self, dry_run=False, verbose=False, skip_confirmation=False, verify_after=False, stage_changes=False):
        self.dry_run = dry_run
        self.verbose = verbose
        self.skip_confirmation = skip_confirmation
        self.verify_after = verify_after
        self.stage_changes = stage_changes
        self.stats = RebrandingStats()
        self.root = Path.cwd()
        self.transaction_log = TransactionLog(self.root / '.rebrand-transaction.json')

        # Files to exclude from content replacement
        self.exclude_files = {
            'rebranding_notes.md',
            'CUSTOMIZATIONS.md',
            'FORAGEN_REBRANDING.md',
            'CHANGELOG.md',
            'README.gemini.md',
            'rebrand_to_foragen_cli.py',
            'verify_rebranding.py',
            '.rebrand-transaction.json',
        }

        # Directories to exclude
        self.exclude_dirs = {
            '.git',
            'node_modules',
            '.npm',
            'dist',
            'build',
        }

    def log_step(self, message):
        """Log a major step."""
        print(f"{Colors.GREEN}==>{Colors.NC} {message}")

    def log_verbose(self, message):
        """Log verbose information."""
        if self.verbose:
            print(f"{Colors.BLUE}  →{Colors.NC} {message}")

    def log_error(self, message, context="General"):
        """Log an error."""
        print(f"{Colors.RED}ERROR:{Colors.NC} {message}", file=sys.stderr)
        self.stats.add_error(context, message)

    def log_warning(self, message, context="General"):
        """Log a warning."""
        print(f"{Colors.YELLOW}WARNING:{Colors.NC} {message}", file=sys.stderr)
        self.stats.add_warning(context, message)

    def should_process_file(self, file_path: Path) -> bool:
        """Check if file should be processed."""
        # Skip excluded files
        if file_path.name in self.exclude_files:
            return False

        # Skip excluded directories
        for part in file_path.parts:
            if part in self.exclude_dirs:
                return False

        # Skip binary files (basic check)
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                f.read(512)  # Try reading first 512 bytes
            return True
        except (UnicodeDecodeError, PermissionError):
            return False

    def find_files_with_content(self, pattern: str) -> List[Path]:
        """Find all files containing a specific pattern."""
        matching_files = []

        for file_path in self.root.rglob('*'):
            if not file_path.is_file():
                continue

            if not self.should_process_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if pattern in content:
                        matching_files.append(file_path)
            except Exception as e:
                self.log_verbose(f"Skipping {file_path}: {e}")

        return matching_files

    def replace_in_file(self, file_path: Path, old: str, new: str) -> int:
        """Replace text in a file. Returns number of replacements."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            if old not in content:
                return 0

            new_content = content.replace(old, new)
            count = content.count(old)

            if not self.dry_run:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)

            return count
        except Exception as e:
            self.log_error(f"Failed to process {file_path}: {e}")
            return 0

    def batch_replace(self, old: str, new: str, description: str):
        """Replace text across all files."""
        self.log_step(f"{description}: '{old}' → '{new}'")

        files = self.find_files_with_content(old)

        if not files:
            self.log_verbose("No files found containing this pattern")
            return

        self.log_verbose(f"Found {len(files)} file(s) to update")

        total_replacements = 0
        for file_path in files:
            count = self.replace_in_file(file_path, old, new)
            if count > 0:
                total_replacements += count
                if self.verbose:
                    relative_path = file_path.relative_to(self.root)
                    if self.dry_run:
                        print(f"    [DRY RUN] Would update: {relative_path} ({count} replacement(s))")
                    else:
                        print(f"    - {relative_path} ({count} replacement(s))")

        if total_replacements > 0:
            self.stats.files_modified += len(files)
            self.stats.replacements_made += total_replacements

    def rename_files(self, old_pattern: str, new_pattern: str, description: str):
        """Rename files containing a pattern (case-insensitive)."""
        self.log_step(description)

        files_to_rename = []
        # Create case-insensitive pattern
        pattern_re = re.compile(re.escape(old_pattern), re.IGNORECASE)

        for file_path in self.root.rglob('*'):
            if not file_path.is_file():
                continue

            # Skip excluded directories
            skip = False
            for part in file_path.parts:
                if part in self.exclude_dirs:
                    skip = True
                    break
            if skip:
                continue

            # Case-insensitive match
            if pattern_re.search(file_path.name):
                # Case-insensitive replace
                new_name = pattern_re.sub(new_pattern, file_path.name)
                new_path = file_path.parent / new_name
                files_to_rename.append((file_path, new_path))

        if not files_to_rename:
            self.log_verbose(f"No files found with '{old_pattern}' in name")
            return

        for old_path, new_path in files_to_rename:
            relative_old = old_path.relative_to(self.root)
            relative_new = new_path.relative_to(self.root)

            self.log_verbose(f"Rename: {relative_old} → {relative_new}")

            if not self.dry_run:
                git_mv_succeeded = False
                try:
                    # Try git mv first
                    try:
                        subprocess.run(['git', 'mv', str(old_path), str(new_path)],
                                     check=True, capture_output=True)
                        git_mv_succeeded = True
                    except (subprocess.CalledProcessError, FileNotFoundError) as e:
                        self.log_warning(f"git mv failed for {old_path.name}: {e}", "File Rename")
                        old_path.rename(new_path)

                    # Record transaction
                    self.transaction_log.record('rename_file', old_path, new_path, success=True)

                    # Warn if git mv failed but regular rename succeeded
                    if not git_mv_succeeded:
                        self.log_warning(f"{new_path.name} renamed without git (history may be lost)", "File Rename")

                    self.stats.files_renamed += 1
                except Exception as e:
                    self.log_error(f"Failed to rename {old_path}: {e}", "File Rename")
                    self.transaction_log.record('rename_file', old_path, new_path, success=False)

    def rename_directories(self, old_pattern: str, new_pattern: str, description: str):
        """Rename directories containing a pattern (deepest first, case-insensitive)."""
        self.log_step(description)

        dirs_to_rename = []
        # Create case-insensitive pattern
        pattern_re = re.compile(re.escape(old_pattern), re.IGNORECASE)

        for dir_path in self.root.rglob('*'):
            if not dir_path.is_dir():
                continue

            # Skip excluded directories
            if dir_path.name in self.exclude_dirs:
                continue

            # Case-insensitive match
            if pattern_re.search(dir_path.name):
                # Case-insensitive replace
                new_name = pattern_re.sub(new_pattern, dir_path.name)
                new_path = dir_path.parent / new_name
                # Store with depth for sorting
                depth = len(dir_path.parts)
                dirs_to_rename.append((depth, dir_path, new_path))

        if not dirs_to_rename:
            self.log_verbose(f"No directories found with '{old_pattern}' in name")
            return

        # Sort by depth (deepest first)
        dirs_to_rename.sort(key=lambda x: x[0], reverse=True)

        for _, old_path, new_path in dirs_to_rename:
            relative_old = old_path.relative_to(self.root)
            relative_new = new_path.relative_to(self.root)

            self.log_verbose(f"Rename: {relative_old} → {relative_new}")

            if not self.dry_run:
                git_mv_succeeded = False
                try:
                    # Try git mv first
                    try:
                        subprocess.run(['git', 'mv', str(old_path), str(new_path)],
                                     check=True, capture_output=True)
                        git_mv_succeeded = True
                    except (subprocess.CalledProcessError, FileNotFoundError) as e:
                        self.log_warning(f"git mv failed for {old_path.name}: {e}", "Directory Rename")
                        old_path.rename(new_path)

                    # Record transaction
                    self.transaction_log.record('rename_dir', old_path, new_path, success=True)

                    # Warn if git mv failed but regular rename succeeded
                    if not git_mv_succeeded:
                        self.log_warning(f"{new_path.name} renamed without git (history may be lost)", "Directory Rename")

                    self.stats.dirs_renamed += 1
                except Exception as e:
                    self.log_error(f"Failed to rename {old_path}: {e}", "Directory Rename")
                    self.transaction_log.record('rename_dir', old_path, new_path, success=False)

    def run_flow_1(self):
        """FLOW 1: qwen-code → foragen-cli"""
        print(f"\n{Colors.BLUE}{'═' * 60}{Colors.NC}")
        print(f"{Colors.BLUE}FLOW 1: qwen-code → foragen-cli (Compound Pattern){Colors.NC}")
        print(f"{Colors.BLUE}{'═' * 60}{Colors.NC}\n")

        # Phase 1.1: Package scopes
        self.log_step("Phase 1.1: Package scopes")
        self.batch_replace(
            "@qwen-code/qwen-code-core",
            "@jeffreysblake/foragen-cli-core",
            "Package: core"
        )
        self.batch_replace(
            "@qwen-code/qwen-code-test-utils",
            "@jeffreysblake/foragen-cli-test-utils",
            "Package: test-utils"
        )
        self.batch_replace(
            "@qwen-code/qwen-code",
            "@jeffreysblake/foragen-cli",
            "Package: cli"
        )
        self.batch_replace(
            "@google/gemini-cli-test-utils",
            "@jeffreysblake/foragen-cli-test-utils",
            "Package: test-utils (from gemini)"
        )

        # Phase 1.2: GitHub URLs and containers
        self.log_step("Phase 1.2: GitHub URLs and container references")
        self.batch_replace(
            "QwenLM/qwen-code-action",
            "jeffreysblake/foragen-cli-action",
            "GitHub Action URL"
        )
        self.batch_replace(
            "QwenLM/qwen-code",
            "jeffreysblake/foragen-cli",
            "GitHub repo URL"
        )
        self.batch_replace(
            "QwenLM/Qwen3-Coder/blob/main/README.md",
            "jeffreysblake/foragen-cli/blob/main/README.md",
            "QwenLM docs redirect to CLI repo"
        )
        self.batch_replace(
            "ghcr.io/qwenlm/qwen-code",
            "foragen-cli-sandbox",
            "Container image (local)"
        )
        self.batch_replace(
            "qwenlm.qwen-code-vscode-ide-companion",
            "jeffreysblake.foragen-cli-vscode-companion",
            "VS Code extension ID"
        )
        self.batch_replace(
            "https://github.com/QwenLM/qwen-code.git",
            "https://github.com/jeffreysblake/foragen-cli.git",
            "Git remote URL"
        )

        # Phase 1.3: Environment variables
        self.log_step("Phase 1.3: Environment variables (UPPER_SNAKE_CASE)")
        env_vars = [
            ("QWEN_CODE_COMPANION_EXTENSION_NAME", "FORAGEN_CLI_COMPANION_EXTENSION_NAME", "companion extension name"),
            ("QWEN_CODE_IDE_SERVER_PORT", "FORAGEN_CLI_IDE_SERVER_PORT", "IDE server port"),
            ("QWEN_CODE_IDE_WORKSPACE_PATH", "FORAGEN_CLI_IDE_WORKSPACE_PATH", "IDE workspace path"),
            ("QWEN_CODE_IDE_SERVER_STDIO_COMMAND", "FORAGEN_CLI_IDE_SERVER_STDIO_COMMAND", "IDE server stdio command"),
            ("QWEN_CODE_IDE_SERVER_STDIO_ARGS", "FORAGEN_CLI_IDE_SERVER_STDIO_ARGS", "IDE server stdio args"),
            ("QWEN_CODE_SYSTEM_SETTINGS_PATH", "FORAGEN_CLI_SYSTEM_SETTINGS_PATH", "system settings path"),
            ("QWEN_CODE_SYSTEM_DEFAULTS_PATH", "FORAGEN_CLI_SYSTEM_DEFAULTS_PATH", "system defaults path"),
            ("QWEN_CODE_VERSION", "FORAGEN_CLI_VERSION", "version"),
            ("QWEN_CODE_TOOL_CALL_STYLE", "FORAGEN_CLI_TOOL_CALL_STYLE", "tool call style"),
            ("QWEN_CODE_FORCE_ENCRYPTED_FILE_STORAGE", "FORAGEN_CLI_FORCE_ENCRYPTED_FILE_STORAGE", "force encrypted storage"),
        ]
        for old, new, desc in env_vars:
            self.batch_replace(old, new, f"Env var: {desc}")

        # Phase 1.4: PascalCase QwenCode
        self.log_step("Phase 1.4: PascalCase QwenCode identifiers")
        self.batch_replace("QwenCodeAgent", "ForagenCliAgent", "Class: QwenCodeAgent")
        self.batch_replace("QwenCode/", "ForagenCli/", "User-Agent prefix")
        self.batch_replace(
            "/Library/Application Support/QwenCode",
            "/Library/Application Support/ForagenCli",
            "macOS app support path"
        )
        self.batch_replace("qwen-code.runQwenCode", "foragen-cli.runForagenCli", "VS Code command")
        self.batch_replace("runQwenCode", "runForagenCli", "VS Code command handler")

        # Phase 1.5: kebab-case compounds
        self.log_step("Phase 1.5: kebab-case qwen-code-* compounds")
        kebab_compounds = [
            ("qwen-code-vscode-ide-companion", "foragen-cli-vscode-companion", "VS Code companion"),
            ("qwen-code-companion-mcp-server", "foragen-cli-companion-mcp-server", "MCP server"),
            ("qwen-code-tool-modify-diffs", "foragen-cli-tool-modify-diffs", "tool modify diffs"),
            ("qwen-code-test-workspace-", "foragen-cli-test-workspace-", "test workspace prefix"),
            ("qwen-code-test-home-", "foragen-cli-test-home-", "test home prefix"),
            ("qwen-code-test-root", "foragen-cli-test-root", "test root"),
            ("qwen-code-ide-server-", "foragen-cli-ide-server-", "IDE server prefix"),
            ("qwen-code-mcp-client", "foragen-cli-mcp-client", "MCP client"),
            ("qwen-code-telemetry-", "foragen-cli-telemetry-", "telemetry prefix"),
            ("qwen-code-releases-", "foragen-cli-releases-", "releases prefix"),
            ("qwen-code-warnings.txt", "foragen-cli-warnings.txt", "warnings file"),
            ("qwen-code-linters", "foragen-cli-linters", "linters temp dir"),
            ("qwen-code-modify-", "foragen-cli-modify-", "modify prefix"),
            ("qwen-code-dev-script", "fora-cli-dev-script", "dev script user agent"),
            ("qwen-code-setup.sh", "foragen-cli-setup.sh", "setup script"),
            ("qwen-code-oauth", "foragen-cli-oauth", "OAuth keychain"),
            ("qwen-code-cli", "foragen-cli", "CLI name"),
            ("qwen-code-sandbox", "foragen-cli-sandbox", "sandbox image"),
            ("qwen-code-pr-review.yml", "foragen-cli-pr-review.yml", "PR review workflow"),
        ]
        for old, new, desc in kebab_compounds:
            self.batch_replace(old, new, desc)

        # Phase 1.6: Space-separated compounds (MUST come before simple replacements)
        self.log_step("Phase 1.6: Space-separated compounds")
        self.batch_replace("Qwen Code", "Foragen CLI", "Compound: Qwen Code")
        self.batch_replace("QWEN CODE", "FORAGEN CLI", "Compound: QWEN CODE")
        self.batch_replace("qwen code", "foragen cli", "Compound: qwen code")
        self.batch_replace("Qwen code", "Foragen cli", "Compound: Qwen code")
        self.batch_replace("qwen Code", "foragen Cli", "Compound: qwen Code")

        # Phase 1.7: Simple qwen-code replacements
        self.log_step("Phase 1.7: Simple qwen-code/qwen_code replacements")
        self.batch_replace("QWEN_CODE", "FORAGEN_CLI", "Simple: QWEN_CODE")
        self.batch_replace("Qwen-Code", "Foragen-Cli", "Simple: Qwen-Code")
        self.batch_replace("qwen-code", "foragen-cli", "Simple: qwen-code")
        self.batch_replace("qwen_code", "foragen_cli", "Simple: qwen_code")

    def run_flow_2(self):
        """FLOW 2: qwen → fora"""
        print(f"\n{Colors.BLUE}{'═' * 60}{Colors.NC}")
        print(f"{Colors.BLUE}FLOW 2: qwen → fora (Simple Pattern){Colors.NC}")
        print(f"{Colors.BLUE}{'═' * 60}{Colors.NC}\n")

        # Phase 2.1: Compound qwen identifiers
        self.log_step("Phase 2.1: Compound qwen identifiers")
        compounds = [
            ("QwenContentGenerator", "ForaContentGenerator", "Class: QwenContentGenerator"),
            ("QwenLogger", "ForaLogger", "Class: QwenLogger"),
            ("QwenOAuth", "ForaOAuth", "Class/prefix: QwenOAuth"),
            ("useQwenAuth", "useForaAuth", "Hook: useQwenAuth"),
            ("qwenOAuth", "foraOAuth", "Variable: qwenOAuth"),
            ("qwenCodeInfoMessageShown", "foragenCliInfoMessageShown", "Variable: qwenCodeInfoMessageShown"),
        ]
        for old, new, desc in compounds:
            self.batch_replace(old, new, desc)

        # Phase 2.2: Simple qwen replacements (case-sensitive order)
        self.log_step("Phase 2.2: Simple qwen replacements")
        self.batch_replace("QWEN_OAUTH", "FORA_OAUTH", "Env var: QWEN_OAUTH")
        self.batch_replace("QWEN_DIR", "FORA_DIR", "Constant: QWEN_DIR")
        self.batch_replace("QWEN", "FORA", "Simple: QWEN")
        self.batch_replace("Qwen", "Fora", "Simple: Qwen")
        self.batch_replace("qwen", "fora", "Simple: qwen")

    def run_phase_3(self):
        """Phase 3: File and directory renames"""
        print(f"\n{Colors.BLUE}{'═' * 60}{Colors.NC}")
        print(f"{Colors.BLUE}Phase 3: File and Directory Renames{Colors.NC}")
        print(f"{Colors.BLUE}{'═' * 60}{Colors.NC}\n")

        # Phase 3.1: Rename files with qwen-code first
        self.rename_files("qwen-code", "foragen-cli", "Phase 3.1: Rename files containing 'qwen-code'")

        # Phase 3.2: Rename files with qwen
        self.rename_files("qwen", "fora", "Phase 3.2: Rename files containing 'qwen'")

        # Phase 3.3: Rename directories with qwen-code first
        self.rename_directories("qwen-code", "foragen-cli", "Phase 3.3: Rename directories containing 'qwen-code'")

        # Phase 3.4: Rename directories with qwen
        self.rename_directories("qwen", "fora", "Phase 3.4: Rename directories containing 'qwen'")

    def pre_flight_check(self) -> bool:
        """Check what will be changed before running."""
        print(f"\n{Colors.BLUE}{'─' * 60}{Colors.NC}")
        print(f"{Colors.BLUE}Pre-flight Check{Colors.NC}")
        print(f"{Colors.BLUE}{'─' * 60}{Colors.NC}\n")

        patterns = {
            "qwen-code": 0,
            "qwen": 0,
            "Qwen": 0,
            "QWEN": 0,
        }

        for pattern in patterns:
            files = self.find_files_with_content(pattern)
            patterns[pattern] = len(files)
            if files:
                print(f"  Found {len(files):3d} files with '{pattern}'")

        total = sum(patterns.values())
        print(f"\n  {Colors.BOLD}Total files to process: {total}{Colors.NC}")

        if total == 0:
            print(f"  {Colors.YELLOW}⚠️  No files found to rebrand!{Colors.NC}")
            return False

        if not self.dry_run and not self.skip_confirmation:
            print(f"\n  {Colors.YELLOW}This will modify {total} files in place.{Colors.NC}")
            response = input(f"  Proceed with rebranding? [y/N]: ")
            return response.lower() == 'y'

        return True

    def run(self):
        """Run the complete rebranding process."""
        print(f"{Colors.BLUE}Starting rebranding: qwen-code → foragen-cli{Colors.NC}")

        if self.dry_run:
            print(f"{Colors.YELLOW}DRY RUN MODE - No changes will be made{Colors.NC}")

        # Pre-flight check
        if not self.pre_flight_check():
            print(f"\n{Colors.YELLOW}Rebranding cancelled.{Colors.NC}")
            return

        # Run each phase with error handling
        phases = [
            ("Flow 1 (qwen-code → foragen-cli)", self.run_flow_1),
            ("Flow 2 (qwen → fora)", self.run_flow_2),
            ("Phase 3 (File renames)", self.run_phase_3),
        ]

        for phase_name, phase_func in phases:
            try:
                phase_func()
            except Exception as e:
                self.log_error(f"{phase_name} failed: {e}", phase_name)
                if self.verbose:
                    import traceback
                    traceback.print_exc()
                # Continue to next phase

        # Save transaction log
        if not self.dry_run:
            self.transaction_log.save()
            print(f"\n{Colors.GREEN}Transaction log saved to: .rebrand-transaction.json{Colors.NC}")

        # Summary
        print(f"\n{Colors.GREEN}{'═' * 60}{Colors.NC}")
        print(f"{Colors.GREEN}Rebranding complete!{Colors.NC}")
        print(f"{Colors.GREEN}{'═' * 60}{Colors.NC}\n")

        print(self.stats.summary())

        # Print errors and warnings
        if self.stats.warnings:
            print(f"\n{Colors.YELLOW}Warnings ({len(self.stats.warnings)}):{Colors.NC}")
            for warning in self.stats.warnings[:10]:  # Show first 10
                print(f"  - {warning}")
            if len(self.stats.warnings) > 10:
                print(f"  ... and {len(self.stats.warnings) - 10} more")

        if self.stats.errors:
            print(f"\n{Colors.RED}Errors ({len(self.stats.errors)}):{Colors.NC}")
            for error in self.stats.errors[:10]:  # Show first 10
                print(f"  - {error}")
            if len(self.stats.errors) > 10:
                print(f"  ... and {len(self.stats.errors) - 10} more")

        if self.dry_run:
            print(f"\n{Colors.YELLOW}This was a DRY RUN - no changes were made{Colors.NC}")
            print(f"{Colors.YELLOW}Run without --dry-run to apply changes{Colors.NC}")
        else:
            print("\nNext steps:")
            print("1. Review changes: git status")
            if self.verify_after:
                print("2. Running verification...")
                self.run_verification()
            else:
                print("2. Run verification: python3 scripts/verify_rebranding.py")
            print("3. Test build: npm run build")
            print("4. Commit changes: git commit -m 'Complete rebranding from qwen-code to foragen-cli'")

            if self.stage_changes:
                print("\n5. Staging changes...")
                self.stage_all_changes()

    def run_verification(self):
        """Run the verification script."""
        try:
            result = subprocess.run(
                [sys.executable, 'scripts/verify_rebranding.py'],
                capture_output=True,
                text=True
            )
            print(result.stdout)
            if result.returncode != 0:
                print(result.stderr)
        except Exception as e:
            self.log_error(f"Failed to run verification: {e}", "Verification")

    def stage_all_changes(self):
        """Stage all changes in git."""
        try:
            subprocess.run(['git', 'add', '-A'], check=True, capture_output=True)
            print(f"{Colors.GREEN}All changes staged in git{Colors.NC}")
        except subprocess.CalledProcessError as e:
            self.log_error(f"Failed to stage changes: {e}", "Git Stage")


def main():
    parser = argparse.ArgumentParser(
        description='Rebrand qwen-code to foragen-cli',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --dry-run              # Preview changes without making them
  %(prog)s --verbose              # Show detailed output
  %(prog)s --dry-run -v           # Preview with details
  %(prog)s --yes                  # Skip confirmation prompt
  %(prog)s --verify               # Run verification after rebranding
  %(prog)s --stage                # Stage all changes in git after rebranding
  %(prog)s                        # Actually perform rebranding
        """
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be changed without making changes'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Show detailed output'
    )
    parser.add_argument(
        '-y', '--yes',
        action='store_true',
        help='Skip confirmation prompt and proceed automatically'
    )
    parser.add_argument(
        '--verify',
        action='store_true',
        help='Run verification script after rebranding completes'
    )
    parser.add_argument(
        '--stage',
        action='store_true',
        help='Stage all changes in git after rebranding'
    )

    args = parser.parse_args()

    rebrander = Rebrander(
        dry_run=args.dry_run,
        verbose=args.verbose,
        skip_confirmation=args.yes,
        verify_after=args.verify,
        stage_changes=args.stage
    )

    try:
        rebrander.run()
        # Exit with error code if errors occurred
        if rebrander.stats.has_errors():
            sys.exit(1)
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Interrupted by user{Colors.NC}")
        sys.exit(130)
    except Exception as e:
        print(f"{Colors.RED}Fatal error: {e}{Colors.NC}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
