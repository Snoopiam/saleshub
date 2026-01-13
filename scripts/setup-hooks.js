#!/usr/bin/env node
/**
 * L-04: Git hooks setup script
 * Installs pre-commit hook for secrets scanning
 *
 * Run: npm run setup:hooks
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const hooksSource = path.join(__dirname, 'hooks');
const gitHooksDir = path.join(projectRoot, '.git', 'hooks');

// Check if we're in a git repository
if (!fs.existsSync(gitHooksDir)) {
  console.error('Error: .git/hooks directory not found.');
  console.error('Make sure you are in a git repository.');
  process.exit(1);
}

// Hooks to install
const hooks = ['pre-commit'];

let installed = 0;
let skipped = 0;

for (const hook of hooks) {
  const source = path.join(hooksSource, hook);
  const dest = path.join(gitHooksDir, hook);

  if (!fs.existsSync(source)) {
    console.warn(`Warning: ${hook} hook source not found at ${source}`);
    continue;
  }

  // Check if hook already exists
  if (fs.existsSync(dest)) {
    const existingContent = fs.readFileSync(dest, 'utf8');
    const newContent = fs.readFileSync(source, 'utf8');

    if (existingContent === newContent) {
      console.log(`✓ ${hook} hook already installed (unchanged)`);
      skipped++;
      continue;
    }

    // Backup existing hook
    const backupPath = `${dest}.backup.${Date.now()}`;
    fs.copyFileSync(dest, backupPath);
    console.log(`  Backed up existing ${hook} to ${path.basename(backupPath)}`);
  }

  // Copy hook
  fs.copyFileSync(source, dest);

  // Make executable (Unix-like systems)
  try {
    fs.chmodSync(dest, '755');
  } catch (e) {
    // Ignore on Windows
  }

  console.log(`✓ Installed ${hook} hook`);
  installed++;
}

console.log('');
console.log(`Done! ${installed} hook(s) installed, ${skipped} unchanged.`);
console.log('');
console.log('The pre-commit hook will scan for potential secrets before each commit.');
console.log('To bypass (not recommended): git commit --no-verify');
