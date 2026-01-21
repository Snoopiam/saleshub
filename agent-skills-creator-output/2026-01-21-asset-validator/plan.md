# Skill Creation Plan: asset-validator

**Session ID**: 2026-01-21-asset-validator
**Created**: 2026-01-21
**Status**: COMPLETE

## Purpose

Create a skill that validates static asset references in HTML/CSS files to catch broken paths before runtime.

## Trigger Scenario

This skill was identified during the SalesHUB audit where `index.html` referenced `KP_blACK.png` but only `KP_Black_new.png` existed.

## Skill Specification

| Field | Value |
|-------|-------|
| Name | `asset-validator` |
| Template | Simple Skill |
| Tools Needed | Glob, Grep, Read, Bash |
| User-Invocable | Yes |

## Capabilities

1. Scan HTML files for `src=` and `href=` attributes
2. Scan CSS files for `url()` references
3. Validate each path exists in filesystem
4. Report broken references with line numbers
5. Suggest similar files (fuzzy matching for typos)

## Tasks

- [x] Create skill directory: `~/.claude/skills/asset-validator/`
- [x] Write SKILL.md with instructions
- [x] Document in execution-history.md

## Outcome

Skill successfully created at `~/.claude/skills/asset-validator/SKILL.md`

The skill can now be invoked with:
- "validate assets"
- "check assets"
- "asset audit"
- "broken links"
- "missing images"
