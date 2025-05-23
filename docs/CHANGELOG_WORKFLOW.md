# Changelog Workflow

This document outlines the workflow for maintaining the VoiceMCP changelog.

## Overview

We follow the [Keep a Changelog](https://keepachangelog.com/) format with [Semantic Versioning](https://semver.org/). Every change that affects users should be documented in the changelog.

## Workflow Process

### 1. During Development

When working on any feature, fix, or improvement:

1. **Make your changes** to the codebase
2. **Update CHANGELOG.md** in the `[Unreleased]` section
3. **Categorize your change** using the appropriate section:
   - **Added** - New features
   - **Changed** - Changes in existing functionality
   - **Deprecated** - Soon-to-be removed features
   - **Removed** - Removed features
   - **Fixed** - Bug fixes
   - **Security** - Security improvements

4. **Write clear descriptions** that focus on user impact
5. **Include task references** when applicable (e.g., `(#TASK123)`)

### 2. Release Process

When ready to release a new version:

1. **Determine version number** based on changes:
   - **PATCH** (0.0.x) - Bug fixes only
   - **MINOR** (0.x.0) - New features, backward compatible
   - **MAJOR** (x.0.0) - Breaking changes

2. **Run the release script**:
   ```bash
   npm run release -- --version patch|minor|major
   ```

3. **The script will**:
   - Move unreleased items to a new version section
   - Update package.json version
   - Create a git tag
   - Generate release notes

### 3. Writing Good Changelog Entries

#### ✅ Good Examples
```markdown
### Added
- Voice recording with real-time audio visualization (#TASK006)
- AI-powered transcript summaries using OpenAI integration (#TASK009)
- System tray integration for background recording (#TASK017)

### Fixed
- Timezone display bug in recording timestamps (#TASK019)
- Memory leaks in audio processing during long recordings
```

#### ❌ Bad Examples
```markdown
### Added
- Updated code
- Fixed stuff
- New feature
```

#### Guidelines:
- **Be specific**: What exactly was added/changed/fixed?
- **User-focused**: How does this affect the user experience?
- **Concise**: One line per change
- **Reference tasks**: Include task IDs when available
- **Use action verbs**: "Added", "Fixed", "Improved", not "Add", "Fix"

## Version Strategy

### Current Versioning Plan

- **0.x.x** - Development releases
  - 0.1.0 - Initial release with core features
  - 0.2.0 - Enhanced features (system audio, calendar integration)
  - 0.3.0 - MCP server integration
- **1.0.0** - First stable release
- **1.x.x** - Stable releases with new features
- **2.0.0** - Major architectural changes

### Release Timing

- **Patch releases** - As needed for bug fixes
- **Minor releases** - When significant features are complete
- **Major releases** - When breaking changes are introduced

## Automation

### Release Script

The `scripts/release.js` script automates:
- Version number updates
- Changelog section movement
- Git tagging
- Release note generation

### Pull Request Template

Every PR should include:
- Checkbox for changelog update
- Change type identification
- Brief description of user impact

## Best Practices

### During Development
1. **Update changelog with each commit** that affects users
2. **Review unreleased section** before making PRs
3. **Group related changes** when possible

### Before Releases
1. **Review all unreleased items** for accuracy
2. **Ensure proper categorization** of changes
3. **Check for missing entries** by reviewing merged PRs
4. **Validate version number** matches change types

### After Releases
1. **Create new unreleased section** immediately
2. **Archive old releases** in git tags
3. **Update documentation** if needed

## Changelog Sections Explained

### Added
New features that add functionality users didn't have before.
- New UI components
- New API endpoints
- New integrations
- New configuration options

### Changed
Changes to existing functionality that users will notice.
- UI redesigns
- Behavior modifications
- Performance improvements
- Default setting changes

### Fixed
Bug fixes that resolve issues users were experiencing.
- Crash fixes
- UI rendering issues
- Data corruption fixes
- Performance problems

### Deprecated
Features that will be removed in future versions.
- Mark with version when removal is planned
- Provide alternatives when possible

### Removed
Features that have been completely removed.
- Discontinued functionality
- Removed APIs
- Deleted configuration options

### Security
Security improvements and vulnerability fixes.
- Dependency updates for security
- Authentication improvements
- Data protection enhancements

## Troubleshooting

### Common Issues

**Merge Conflicts in CHANGELOG.md**
- Multiple developers editing unreleased section
- Solution: Use specific, descriptive entries and resolve manually

**Missing Changelog Entries**
- Changes shipped without documentation
- Solution: Add to next release with "retroactively documented" note

**Version Number Confusion**
- Unclear what type of change warrants version bump
- Solution: Follow semantic versioning strictly

### Recovery Procedures

**Incorrect Version Released**
1. Add corrective entry to next release
2. Don't modify published changelog entries
3. Document the correction clearly

**Missing Historical Entries**
1. Add to "Development History" section
2. Mark as retroactively documented
3. Don't modify version sections

## Tools and Resources

- [Keep a Changelog](https://keepachangelog.com/) - Format specification
- [Semantic Versioning](https://semver.org/) - Version numbering
- [GitHub Release Notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes) - Automated release notes
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit message format
