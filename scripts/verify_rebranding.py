#!/usr/bin/env python3
"""
Verify Rebranding: qwen-code → foragen-cli

This script verifies that the rebranding was completed successfully by
checking for any remaining references to the old naming.

Pure Python stdlib - no external dependencies required.
"""

import sys
import re
import json
import argparse
from pathlib import Path
from typing import List, Tuple, Set, Dict

# ANSI color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    BOLD = '\033[1m'
    NC = '\033[0m'  # No Color


class VerificationResults:
    """Track verification results."""
    def __init__(self):
        self.errors = 0
        self.warnings = 0
        self.checks_passed = 0
        self.error_details: List[Dict] = []
        self.warning_details: List[Dict] = []

    def add_error(self, check: str = "", details: List = None):
        self.errors += 1
        if check:
            self.error_details.append({
                'check': check,
                'matches': details or []
            })

    def add_warning(self, check: str = "", details: List = None):
        self.warnings += 1
        if check:
            self.warning_details.append({
                'check': check,
                'matches': details or []
            })

    def add_pass(self):
        self.checks_passed += 1

    def to_dict(self) -> Dict:
        """Convert results to dictionary for JSON output."""
        return {
            'success': self.errors == 0,
            'checks_passed': self.checks_passed,
            'errors': self.errors,
            'warnings': self.warnings,
            'error_details': self.error_details,
            'warning_details': self.warning_details
        }


class Verifier:
    """Main verification class."""

    def __init__(self, json_output: bool = False):
        self.root = Path.cwd()
        self.results = VerificationResults()
        self.json_output = json_output

        # Files to exclude from verification
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

        # Patterns that are acceptable in certain contexts (for warnings not errors)
        self.acceptable_upstream_patterns = {
            'upstream-qwen',
            'qwen-upstream',
            'Original Repository',
            'based on',
            'adapted from',
            'fork of',
            'Upstream',
            'QwenLM/qwen-code',  # In comments about upstream
        }

    def should_check_file(self, file_path: Path) -> bool:
        """Check if file should be verified."""
        # Skip excluded files
        if file_path.name in self.exclude_files:
            return False

        # Skip excluded directories
        for part in file_path.parts:
            if part in self.exclude_dirs:
                return False

        # Only check text files
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                f.read(512)  # Try reading first 512 bytes
            return True
        except (UnicodeDecodeError, PermissionError):
            return False

    def find_pattern_in_files(self, pattern: str, is_regex: bool = False, case_insensitive: bool = True) -> List[Tuple[Path, int, str]]:
        """Find pattern in files. Returns list of (file, line_number, line_content)."""
        matches = []

        # Create regex pattern for case-insensitive matching
        if is_regex:
            regex_pattern = re.compile(pattern, re.IGNORECASE if case_insensitive else 0)
        elif case_insensitive:
            regex_pattern = re.compile(re.escape(pattern), re.IGNORECASE)
        else:
            regex_pattern = None

        for file_path in self.root.rglob('*'):
            if not file_path.is_file():
                continue

            if not self.should_check_file(file_path):
                continue

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        if regex_pattern:
                            if regex_pattern.search(line):
                                matches.append((file_path, line_num, line.strip()))
                        else:
                            if pattern in line:
                                matches.append((file_path, line_num, line.strip()))
            except Exception:
                continue

        return matches

    def check_pattern(self, pattern: str, description: str,
                     exclude_context: str = None, is_error: bool = True) -> bool:
        """Check for a pattern. Returns True if check passed (pattern not found)."""
        if not self.json_output:
            print(f"Checking for '{pattern}' ({description})... ", end='', flush=True)

        matches = self.find_pattern_in_files(pattern)

        # Filter out acceptable contexts if specified
        if exclude_context:
            filtered_matches = []
            for file_path, line_num, line in matches:
                if exclude_context.lower() not in line.lower():
                    filtered_matches.append((file_path, line_num, line))
            matches = filtered_matches

        if matches:
            # Prepare match details for JSON
            match_details = [
                {
                    'file': str(file_path.relative_to(self.root)),
                    'line': line_num,
                    'content': line[:80]
                }
                for file_path, line_num, line in matches
            ]

            if is_error:
                if not self.json_output:
                    print(f"{Colors.RED}FAIL{Colors.NC}")
                self.results.add_error(f"{pattern} ({description})", match_details)
            else:
                if not self.json_output:
                    print(f"{Colors.YELLOW}WARN{Colors.NC}")
                self.results.add_warning(f"{pattern} ({description})", match_details)

            # Show first 20 matches (only if not JSON mode)
            if not self.json_output:
                for file_path, line_num, line in matches[:20]:
                    relative_path = file_path.relative_to(self.root)
                    print(f"  {relative_path}:{line_num}: {line[:80]}")

                if len(matches) > 20:
                    print(f"{Colors.YELLOW}  ... and {len(matches) - 20} more{Colors.NC}")
                print()
            return False
        else:
            if not self.json_output:
                print(f"{Colors.GREEN}OK{Colors.NC}")
            self.results.add_pass()
            return True

    def check_file_exists(self, file_path: str, description: str) -> bool:
        """Check that a file doesn't exist. Returns True if check passed (file doesn't exist)."""
        print(f"Checking that {description} doesn't exist... ", end='', flush=True)

        path = self.root / file_path
        if path.exists():
            print(f"{Colors.RED}FAIL{Colors.NC}")
            print(f"  File still exists: {file_path}")
            self.results.add_error()
            return False
        else:
            print(f"{Colors.GREEN}OK{Colors.NC}")
            self.results.add_pass()
            return True

    def check_nested_directories(self, pattern: str, description: str) -> bool:
        """Check for nested directories. Returns True if check passed (no nesting found)."""
        print(f"Checking for nested '{pattern}' directories... ", end='', flush=True)

        nested_dirs = []
        for dir_path in self.root.rglob('*'):
            if not dir_path.is_dir():
                continue

            # Skip excluded directories
            if dir_path.name in self.exclude_dirs:
                continue

            # Check for pattern/pattern nesting
            path_str = str(dir_path)
            if f"/{pattern}/{pattern}" in path_str or f"\\{pattern}\\{pattern}" in path_str:
                nested_dirs.append(dir_path)

        if nested_dirs:
            print(f"{Colors.RED}FAIL{Colors.NC}")
            for dir_path in nested_dirs:
                relative_path = dir_path.relative_to(self.root)
                print(f"  {relative_path}")
            print()
            self.results.add_error()
            return False
        else:
            print(f"{Colors.GREEN}OK{Colors.NC}")
            self.results.add_pass()
            return True

    def check_package_json_bin(self) -> bool:
        """Check package.json for correct bin entry."""
        package_json = self.root / 'package.json'

        if not package_json.exists():
            print(f"{Colors.YELLOW}WARN: package.json not found{Colors.NC}")
            self.results.add_warning()
            return False

        print("Checking package.json bin entry... ", end='', flush=True)

        try:
            with open(package_json, 'r', encoding='utf-8') as f:
                content = f.read()

            has_old_bin = '"qwen":' in content
            has_new_bin = '"fora":' in content

            if has_old_bin:
                print(f"{Colors.RED}FAIL{Colors.NC}")
                print(f"  Still has 'qwen' bin entry")
                self.results.add_error()
                return False
            elif not has_new_bin:
                print(f"{Colors.RED}FAIL{Colors.NC}")
                print(f"  Missing 'fora' bin entry")
                self.results.add_error()
                return False
            else:
                print(f"{Colors.GREEN}OK{Colors.NC}")
                self.results.add_pass()
                return True

        except Exception as e:
            print(f"{Colors.RED}ERROR: {e}{Colors.NC}")
            self.results.add_error()
            return False

    def run(self):
        """Run all verification checks."""
        if not self.json_output:
            print(f"{Colors.BLUE}Verifying rebranding from qwen-code to foragen-cli{Colors.NC}\n")

        # Package Name Checks
        if not self.json_output:
            print(f"{Colors.BLUE}=== Package Name Checks ==={Colors.NC}")
        self.check_pattern("@qwen-code/qwen-code-core", "old core package name")
        self.check_pattern("@qwen-code/qwen-code-test-utils", "old test-utils package name")
        self.check_pattern("@qwen-code/qwen-code", "old cli package name")
        self.check_pattern("@google/gemini-cli", "gemini package references")
        if not self.json_output:
            print()

        # URL and Repository Checks
        if not self.json_output:
            print(f"{Colors.BLUE}=== URL and Repository Checks ==={Colors.NC}")
        self.check_pattern("QwenLM/qwen-code", "upstream GitHub URLs",
                          exclude_context="upstream", is_error=False)
        self.check_pattern("ghcr.io/qwenlm/qwen-code", "upstream container image", is_error=False)
        self.check_pattern("qwenlm.github.io/qwen-code-docs", "upstream docs URLs", is_error=False)
        if not self.json_output:
            print()

        # VS Code Extension Checks
        if not self.json_output:
            print(f"{Colors.BLUE}=== VS Code Extension Checks ==={Colors.NC}")
        self.check_pattern("qwenlm.qwen-code-vscode", "old VS Code extension ID")
        self.check_pattern("qwen-code-vscode-ide-companion", "old VS Code companion package")
        if not self.json_output:
            print()

        # Environment Variable Checks
        if not self.json_output:
            print(f"{Colors.BLUE}=== Environment Variable Checks ==={Colors.NC}")
        self.check_pattern("QWEN_CODE_COMPANION_EXTENSION_NAME", "old env var")
        self.check_pattern("QWEN_CODE_IDE_SERVER_PORT", "old env var")
        self.check_pattern("QWEN_CODE_IDE_WORKSPACE_PATH", "old env var")
        self.check_pattern("QWEN_CODE_SYSTEM_SETTINGS_PATH", "old env var")
        self.check_pattern("QWEN_CODE_VERSION", "old env var")
        if not self.json_output:
            print()

        # Code Identifier Checks
        if not self.json_output:
            print(f"{Colors.BLUE}=== Code Identifier Checks ==={Colors.NC}")
        self.check_pattern("QwenCodeAgent", "old agent class name")
        self.check_pattern("class QwenCode", "QwenCode classes")
        self.check_pattern("qwenCodeInfo", "qwenCode variables")
        if not self.json_output:
            print()

        # File and Directory Path Checks
        if not self.json_output:
            print(f"{Colors.BLUE}=== File and Directory Path Checks ==={Colors.NC}")
        self.check_pattern("qwen-code-sandbox", "old sandbox name")
        self.check_pattern("qwen-code-oauth", "old OAuth service name")
        self.check_pattern("/qwen-code/", "qwen-code in paths")
        if not self.json_output:
            print()

        # Binary and Command Checks
        if not self.json_output:
            print(f"{Colors.BLUE}=== Binary and Command Checks ==={Colors.NC}")
        self.check_package_json_bin()
        if not self.json_output:
            print()

        # Nested Directory Checks
        if not self.json_output:
            print(f"{Colors.BLUE}=== Nested Directory Checks ==={Colors.NC}")
        self.check_nested_directories("fora", "nested fora directories")
        self.check_nested_directories("foragen-cli", "nested foragen-cli directories")
        if not self.json_output:
            print()

        # Workflow File Checks
        if not self.json_output:
            print(f"{Colors.BLUE}=== Workflow File Checks ==={Colors.NC}")
        self.check_file_exists(".github/workflows/qwen-code-pr-review.yml", "old PR review workflow")
        self.check_file_exists(".github/workflows/qwen-scheduled-issue-triage.yml", "old scheduled triage workflow")
        self.check_file_exists(".github/workflows/qwen-automated-issue-triage.yml", "old automated triage workflow")
        if not self.json_output:
            print()

        # Summary
        self.print_summary()

    def print_summary(self):
        """Print verification summary."""
        if self.json_output:
            # Output JSON
            print(json.dumps(self.results.to_dict(), indent=2))
            sys.exit(0 if self.results.errors == 0 else 1)

        print(f"{Colors.BLUE}{'═' * 60}{Colors.NC}\n")

        if self.results.errors == 0 and self.results.warnings == 0:
            print(f"{Colors.GREEN}✓ Verification PASSED!{Colors.NC}")
            print(f"{Colors.GREEN}All checks completed successfully.{Colors.NC}")
            print(f"\nChecks passed: {self.results.checks_passed}")
            sys.exit(0)
        elif self.results.errors == 0:
            print(f"{Colors.YELLOW}⚠ Verification completed with WARNINGS{Colors.NC}")
            print(f"Checks passed: {self.results.checks_passed}")
            print(f"{Colors.YELLOW}Warnings: {self.results.warnings}{Colors.NC}\n")
            print(f"{Colors.YELLOW}These are typically references to upstream documentation.{Colors.NC}")
            print(f"{Colors.YELLOW}Review the warnings above to ensure they are acceptable.{Colors.NC}")
            sys.exit(0)
        else:
            print(f"{Colors.RED}✗ Verification FAILED!{Colors.NC}")
            print(f"Checks passed: {self.results.checks_passed}")
            print(f"{Colors.RED}Errors: {self.results.errors}{Colors.NC}")
            if self.results.warnings > 0:
                print(f"{Colors.YELLOW}Warnings: {self.results.warnings}{Colors.NC}")
            print(f"\n{Colors.RED}Please fix the errors above before proceeding.{Colors.NC}")
            sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description='Verify rebranding from qwen-code to foragen-cli',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s               # Run verification with console output
  %(prog)s --json        # Output results as JSON
        """
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Output results as JSON'
    )

    args = parser.parse_args()

    verifier = Verifier(json_output=args.json)

    try:
        verifier.run()
    except KeyboardInterrupt:
        if not args.json:
            print(f"\n{Colors.YELLOW}Interrupted by user{Colors.NC}")
        sys.exit(130)
    except Exception as e:
        if args.json:
            error_result = {
                'success': False,
                'error': str(e),
                'checks_passed': 0,
                'errors': 1,
                'warnings': 0
            }
            print(json.dumps(error_result, indent=2))
        else:
            print(f"{Colors.RED}Fatal error: {e}{Colors.NC}", file=sys.stderr)
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
