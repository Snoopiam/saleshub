# Asset Validation Plan: SalesHUB Full Scan

**Session ID**: 2026-01-21-full-scan
**Created**: 2026-01-21
**Status**: COMPLETE

## Scope

Full project scan of SalesHUB to identify broken asset references.

## Phases

### Phase 1: Scan for Asset References
- [x] Scan HTML files for src/href attributes
- [x] Scan CSS files for url() declarations
- [x] Extract all asset paths

### Phase 2: Validate References
- [x] Filter out external URLs
- [x] Check each path exists in filesystem
- [x] Record broken references

### Phase 3: Generate Report
- [x] Create summary statistics
- [x] List broken references with line numbers
- [x] Generate suggestions for typos

### Phase 4: Fuzzy Matching
- [x] Find similar files for broken references
- [x] Suggest corrections

## Results

| Metric | Value |
|--------|-------|
| Files scanned | 1 |
| References found | 8 |
| Broken references | 1 |
| Suggested fixes | 1 |

## Broken Reference

`index.html:784` references `assets/logos/KP_blACK.png` but file does not exist.
**Suggestion**: Use `KP_Black_new.png` instead.
