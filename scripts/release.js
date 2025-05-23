#!/usr/bin/env node

/**
 * Release automation script for VoiceMCP
 * 
 * This script automates the release process by:
 * - Updating version numbers in package.json
 * - Moving unreleased changelog entries to a new version section
 * - Creating git tags
 * - Generating release notes
 * 
 * Usage: node scripts/release.js --version [patch|minor|major|x.y.z]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ Error: ${message}`, 'red');
  process.exit(1);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const versionIndex = args.indexOf('--version');
  
  if (versionIndex === -1 || !args[versionIndex + 1]) {
    error('Version argument required. Usage: --version [patch|minor|major|x.y.z]');
  }
  
  return {
    version: args[versionIndex + 1],
    dryRun: args.includes('--dry-run'),
    skipGit: args.includes('--skip-git')
  };
}

/**
 * Validate version string
 */
function isValidVersion(version) {
  const semVerRegex = /^\d+\.\d+\.\d+$/;
  return ['patch', 'minor', 'major'].includes(version) || semVerRegex.test(version);
}

/**
 * Get current version from package.json
 */
function getCurrentVersion() {
  const packagePath = path.join(process.cwd(), 'voice-mcp', 'package.json');
  if (!fs.existsSync(packagePath)) {
    error('package.json not found in voice-mcp directory');
  }
  
  const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return packageContent.version;
}

/**
 * Calculate new version number
 */
function calculateNewVersion(currentVersion, versionType) {
  if (versionType.match(/^\d+\.\d+\.\d+$/)) {
    return versionType;
  }
  
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  switch (versionType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      error(`Invalid version type: ${versionType}`);
  }
}

/**
 * Update package.json version
 */
function updatePackageVersion(newVersion, dryRun) {
  const packagePath = path.join(process.cwd(), 'voice-mcp', 'package.json');
  const packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  packageContent.version = newVersion;
  
  if (!dryRun) {
    fs.writeFileSync(packagePath, JSON.stringify(packageContent, null, 2) + '\n');
    success(`Updated package.json version to ${newVersion}`);
  } else {
    info(`[DRY RUN] Would update package.json version to ${newVersion}`);
  }
}

/**
 * Read and parse changelog
 */
function readChangelog() {
  const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
  if (!fs.existsSync(changelogPath)) {
    error('CHANGELOG.md not found');
  }
  
  return fs.readFileSync(changelogPath, 'utf8');
}

/**
 * Extract unreleased changes from changelog
 */
function extractUnreleasedChanges(changelog) {
  const unreleasedStart = changelog.indexOf('## [Unreleased]');
  if (unreleasedStart === -1) {
    error('No [Unreleased] section found in changelog');
  }
  
  const nextSectionStart = changelog.indexOf('\n## [', unreleasedStart + 1);
  const unreleasedEnd = nextSectionStart === -1 ? changelog.length : nextSectionStart;
  
  const unreleasedSection = changelog.substring(unreleasedStart, unreleasedEnd).trim();
  
  // Check if there are actual changes (not just the header)
  const hasChanges = unreleasedSection.includes('### Added') || 
                    unreleasedSection.includes('### Changed') || 
                    unreleasedSection.includes('### Fixed') || 
                    unreleasedSection.includes('### Removed') ||
                    unreleasedSection.includes('### Security') ||
                    unreleasedSection.includes('### Deprecated');
  
  if (!hasChanges) {
    warning('No unreleased changes found in changelog');
    return null;
  }
  
  // Clean up the section - remove empty subsections
  const lines = unreleasedSection.split('\n');
  const cleanedLines = [];
  let inEmptySection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];
    
    // Skip empty sections
    if (line.startsWith('### ') && (!nextLine || nextLine.trim() === '' || nextLine.startsWith('### '))) {
      inEmptySection = true;
      continue;
    }
    
    if (!inEmptySection) {
      cleanedLines.push(line);
    } else if (line.startsWith('### ')) {
      inEmptySection = false;
      cleanedLines.push(line);
    }
  }
  
  return cleanedLines.join('\n').trim();
}

/**
 * Update changelog with new version
 */
function updateChangelog(newVersion, unreleasedChanges, dryRun) {
  const changelog = readChangelog();
  const today = new Date().toISOString().split('T')[0];
  
  // Create new version section
  const newVersionSection = unreleasedChanges
    .replace('## [Unreleased]', `## [${newVersion}] - ${today}`);
  
  // Create new unreleased section
  const newUnreleasedSection = '## [Unreleased]\n';
  
  // Find insertion points
  const unreleasedStart = changelog.indexOf('## [Unreleased]');
  const nextSectionStart = changelog.indexOf('\n## [', unreleasedStart + 1);
  
  let updatedChangelog;
  if (nextSectionStart === -1) {
    // No other versions, insert before Development History
    const devHistoryStart = changelog.indexOf('\n## Development History');
    if (devHistoryStart === -1) {
      // No development history, append at end
      updatedChangelog = changelog.substring(0, unreleasedStart) + 
                        newUnreleasedSection + '\n' + 
                        newVersionSection + '\n';
    } else {
      updatedChangelog = changelog.substring(0, unreleasedStart) + 
                        newUnreleasedSection + '\n' + 
                        newVersionSection + '\n' +
                        changelog.substring(devHistoryStart);
    }
  } else {
    // Insert new version before existing versions
    updatedChangelog = changelog.substring(0, unreleasedStart) + 
                      newUnreleasedSection + '\n' + 
                      newVersionSection + '\n' +
                      changelog.substring(nextSectionStart);
  }
  
  if (!dryRun) {
    fs.writeFileSync('CHANGELOG.md', updatedChangelog);
    success(`Updated CHANGELOG.md with version ${newVersion}`);
  } else {
    info(`[DRY RUN] Would update CHANGELOG.md with version ${newVersion}`);
  }
  
  return newVersionSection;
}

/**
 * Generate release notes from changelog section
 */
function generateReleaseNotes(versionSection, version) {
  // Extract just the changes, removing the header
  const lines = versionSection.split('\n');
  const contentLines = [];
  let startIndex = 0;
  
  // Find where content starts (after version header and any empty lines)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('### ')) {
      startIndex = i;
      break;
    }
  }
  
  // Collect content lines
  for (let i = startIndex; i < lines.length; i++) {
    contentLines.push(lines[i]);
  }
  
  const notes = contentLines.join('\n').trim();
  
  const releaseNotes = `Release ${version}

${notes}

---

Release generated on ${new Date().toISOString().split('T')[0]}
`;
  
  return releaseNotes;
}

/**
 * Create git tag
 */
function createGitTag(version, releaseNotes, dryRun, skipGit) {
  if (skipGit) {
    info('Skipping git operations');
    return;
  }
  
  try {
    if (!dryRun) {
      // Check for uncommitted changes
      try {
        execSync('git diff-index --quiet HEAD --');
      } catch {
        warning('You have uncommitted changes. Please commit or stash them before creating a release.');
        warning('You can use --skip-git to skip git operations.');
        process.exit(1);
      }
      
      // Stage the changes
      execSync('git add CHANGELOG.md voice-mcp/package.json', { stdio: 'inherit' });
      
      // Commit the changes
      execSync(`git commit -m "Release version ${version}"`, { stdio: 'inherit' });
      
      // Create annotated tag with release notes
      const tempFile = path.join(process.cwd(), '.release-notes.tmp');
      fs.writeFileSync(tempFile, releaseNotes);
      
      execSync(`git tag -a v${version} -F ${tempFile}`, { stdio: 'inherit' });
      
      // Clean up temp file
      fs.unlinkSync(tempFile);
      
      success(`Created git tag v${version}`);
    } else {
      info('[DRY RUN] Would commit changes and create git tag');
    }
    
    info('\nNext steps:');
    info('1. Push changes: git push origin main');
    info(`2. Push tag: git push origin v${version}`);
    info('3. Create GitHub release from the tag');
    
  } catch (err) {
    error(`Git operations failed: ${err.message}`);
  }
}

/**
 * Main release process
 */
function main() {
  log('\n🚀 VoiceMCP Release Script\n', 'cyan');
  
  // Parse arguments
  const { version, dryRun, skipGit } = parseArgs();
  
  if (dryRun) {
    warning('Running in DRY RUN mode - no changes will be made\n');
  }
  
  // Validate version
  if (!isValidVersion(version)) {
    error(`Invalid version: ${version}. Use patch, minor, major, or x.y.z format.`);
  }
  
  // Get current version
  const currentVersion = getCurrentVersion();
  info(`Current version: ${currentVersion}`);
  
  // Calculate new version
  const newVersion = calculateNewVersion(currentVersion, version);
  info(`New version: ${newVersion}\n`);
  
  // Extract unreleased changes
  const changelog = readChangelog();
  const unreleasedChanges = extractUnreleasedChanges(changelog);
  
  if (!unreleasedChanges) {
    error('No unreleased changes to release. Add changes to [Unreleased] section first.');
  }
  
  // Update package.json
  updatePackageVersion(newVersion, dryRun);
  
  // Update changelog
  const versionSection = updateChangelog(newVersion, unreleasedChanges, dryRun);
  
  // Generate release notes
  const releaseNotes = generateReleaseNotes(versionSection, newVersion);
  
  if (!dryRun) {
    // Save release notes
    const releaseNotesPath = path.join(process.cwd(), `release-notes-${newVersion}.md`);
    fs.writeFileSync(releaseNotesPath, releaseNotes);
    success(`Generated release notes: ${releaseNotesPath}`);
  }
  
  // Create git tag
  createGitTag(newVersion, releaseNotes, dryRun, skipGit);
  
  log('\n✨ Release process complete!\n', 'green');
}

// Run the script
main();
