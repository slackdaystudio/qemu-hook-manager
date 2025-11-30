# Future Improvements

## High Priority

### Add --dry-run flag
Preview what changes will be made before writing to `/etc/libvirt/hooks/`. Should show:
- Which hook scripts will be created
- Which symlinks will be created/removed
- Which files will be overwritten

### Add --clean command
Re-enable and expose the `cleanHooks()` function to allow users to remove all qhm-managed hooks. Currently commented out in index.js (lines 74-75).

### Input sanitization
Replace regex-based validation with proper shell escaping. Current approach constructs shell commands via string concatenation (`command.join(" ")`), which is vulnerable to injection even with regex validation. Consider using `execFile` instead of `exec` to avoid shell interpretation entirely.

Affected areas:
- `general.js`: `enablePassthrough()`, `disablePassthrough()`, `fetchActiveDomains()`
- `virsh.js`: `domainExists()`, `fetchAllDomains()`

### Error recovery / rollback
If hook installation fails partway through, the system is left in a broken state with partial hooks. Implement:
- Transaction-like behavior: collect all changes, apply atomically
- Rollback mechanism on failure
- Or at minimum, clear error messaging about what succeeded/failed

## Medium Priority

### Improve error handling
Many functions silently swallow errors and return empty arrays/objects:
- `fetchActiveDomains()` returns `[]` on any error
- `ls()` returns `{}` on any error
- `fileExists()` returns `false` on any error

Add proper error logging or propagation to aid debugging.

### Integration tests
Unit tests mock all external dependencies. Add integration tests that run against a real libvirt system to verify:
- IOMMU group detection works on real hardware
- Hook scripts are correctly installed and executable
- Symlinks are created properly
- virsh commands work as expected

### Validate hook scripts before installation
Check that hook template scripts:
- Exist at the expected paths
- Are valid shell scripts (shellcheck?)
- Have the expected `$IOMMU_GROUP_ID` placeholder

## Low Priority

### Add --verbose flag documentation
The `--verbose` flag exists in logger.js but isn't documented in README.md or --help output.

### Improve UX when no IOMMU groups found
Currently fails silently or shows empty list. Should detect this case and provide helpful guidance (check BIOS settings, kernel parameters, etc.).

### Add --uninstall for specific domains
Allow removing passthrough from specific VMs without affecting others, rather than all-or-nothing cleanup.
