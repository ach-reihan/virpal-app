/**
 * setup-functions.cjs
 *
 * Comprehensive Azure Functions build setup script that handles:
 * - Directory structure creation
 * - ES module configuration
 * - File extension conversion (.js to .mjs)
 * - Import statement fixes
 * - Service file copying
 * - CORS configuration
 */

const fs = require('fs');
const path = require('path');

// Track changes made
const changes = [];

// === DIRECTORY SETUP ===
function ensureDirectoriesExist() {
  const directories = ['dist', 'dist/functions', 'dist/services'];

  directories.forEach((dir) => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      changes.push(`Created ${dir} directory`);
    }
  });
}

// === ES MODULE CONFIGURATION ===
function setupESModules() {
  const packageJsonPath = path.join(__dirname, '..', 'dist', 'package.json');
  const esmPackage = {
    type: 'module',
    main: 'index.mjs',
  };

  if (
    !fs.existsSync(packageJsonPath) ||
    JSON.stringify(JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))) !==
      JSON.stringify(esmPackage)
  ) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(esmPackage, null, 2));
    changes.push('Updated dist/package.json with ES module config');
  }
}

// === FILE CONVERSION (.js to .mjs) ===
function convertFilesToMJS() {
  const distDir = path.join(__dirname, '..', 'dist');
  const renamedFiles = [];

  // Recursively convert all .js files to .mjs in dist directory
  function convertDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        convertDirectory(filePath); // Recursive call for subdirectories
      } else if (file.endsWith('.js') && !file.endsWith('.js.map')) {
        const mjsFilePath = filePath.replace(/\.js$/, '.mjs');
        if (!fs.existsSync(mjsFilePath)) {
          fs.renameSync(filePath, mjsFilePath);
          renamedFiles.push({
            oldName: file,
            newName: file.replace('.js', '.mjs'),
            directory: path.relative(distDir, dir),
          });
          changes.push(
            `Converted ${path.relative(distDir, filePath)} to ${path.relative(
              distDir,
              mjsFilePath
            )}`
          );
        }
      }
    });
  }

  convertDirectory(distDir);

  // Update imports in all .mjs files if files were renamed
  if (renamedFiles.length > 0) {
    updateAllImports(distDir, renamedFiles);
  }

  // Clean up any remaining .js files (except .js.map)
  cleanupJSFiles(distDir);
}

// === IMPORT UPDATES ===
function updateImportsInIndex(indexMjsPath, renamedFiles) {
  let indexContent = fs.readFileSync(indexMjsPath, 'utf8');
  let updatedImports = false;

  renamedFiles.forEach(({ oldName, newName }) => {
    const oldImportPattern = new RegExp(
      `import ['"]\\.\/functions\/${oldName.replace('.js', '')}\\.[jt]s['"]`,
      'g'
    );
    const newImport = `import './functions/${newName.replace('.mjs', '')}.mjs'`;

    if (oldImportPattern.test(indexContent)) {
      indexContent = indexContent.replace(oldImportPattern, newImport);
      updatedImports = true;
    }

    // Handle direct path references
    const directPathPattern = new RegExp(`\\.\/functions\\/${oldName}`, 'g');
    if (directPathPattern.test(indexContent)) {
      indexContent = indexContent.replace(
        directPathPattern,
        `./functions/${newName}`
      );
      updatedImports = true;
    }
  });

  if (updatedImports) {
    fs.writeFileSync(indexMjsPath, indexContent);
    changes.push('Updated imports in index.mjs to reference .mjs files');
  }
}

// === UPDATE ALL IMPORTS ===
function updateAllImports(distDir, renamedFiles) {
  function updateImportsInDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        updateImportsInDirectory(filePath);
      } else if (file.endsWith('.mjs')) {
        updateImportsInFile(filePath, renamedFiles, distDir);
      }
    });
  }

  updateImportsInDirectory(distDir);
}

function updateImportsInFile(filePath, renamedFiles, distDir) {
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;

  // Update import statements to use .mjs extensions
  content = content.replace(
    /from\s+['"](\.\.?\/[^'"]+?)\.js['"]/g,
    (match, importPath) => {
      updated = true;
      return match.replace('.js', '.mjs');
    }
  );

  content = content.replace(
    /import\s+['"](\.\.?\/[^'"]+?)\.js['"]/g,
    (match, importPath) => {
      updated = true;
      return match.replace('.js', '.mjs');
    }
  );

  // Fix relative imports that don't specify extensions
  content = content.replace(
    /from\s+['"](\.\.?\/[^'"]+?)['"](?!['"]*\.m?js)/g,
    (match, importPath) => {
      const targetPath = path.resolve(
        path.dirname(filePath),
        importPath + '.mjs'
      );
      if (fs.existsSync(targetPath)) {
        updated = true;
        return match.replace(importPath, importPath + '.mjs');
      }
      return match;
    }
  );

  if (updated) {
    fs.writeFileSync(filePath, content);
    const relativePath = path.relative(distDir, filePath);
    changes.push(`Updated imports in ${relativePath}`);
  }
}

// === CLEANUP JS FILES ===
function cleanupJSFiles(distDir) {
  function cleanupDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        cleanupDirectory(filePath);
      } else if (file.endsWith('.js') && !file.endsWith('.js.map')) {
        fs.unlinkSync(filePath);
        const relativePath = path.relative(distDir, filePath);
        changes.push(`Removed ${relativePath} (only .mjs files needed)`);
      }
    });
  }

  cleanupDirectory(distDir);
}

// === SERVICE FILE SETUP ===
function setupServiceFiles() {
  const distDir = path.join(__dirname, '..', 'dist');

  // Convert all .js service files to .mjs
  function convertServiceFilesInDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        convertServiceFilesInDirectory(filePath);
      } else if (file.endsWith('.js') && !file.endsWith('.js.map')) {
        const mjsFilePath = filePath.replace(/\.js$/, '.mjs');
        if (!fs.existsSync(mjsFilePath)) {
          fs.copyFileSync(filePath, mjsFilePath);
          const relativePath = path.relative(distDir, mjsFilePath);
          changes.push(`Created ${relativePath} from .js file`);
        }
      }
    });
  }

  convertServiceFilesInDirectory(path.join(distDir, 'services'));
}

// === IMPORT SYNTAX FIXES ===
function fixImportSyntax() {
  const distDir = path.join(__dirname, '..', 'dist');

  function fixImportsInDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        fixImportsInDirectory(filePath);
      } else if (file.endsWith('.mjs')) {
        fixImportsInMJSFile(filePath, distDir);
      }
    });
  }

  fixImportsInDirectory(distDir);
}

function fixImportsInMJSFile(filePath, distDir) {
  let content = fs.readFileSync(filePath, 'utf8');
  let importFixed = false;

  // Fix malformed import statements
  const malformedImportPattern = /import\s+([^;'"]+);/g;
  content = content.replace(malformedImportPattern, (match, importPath) => {
    if (!importPath.includes('from')) {
      // This is a malformed import, try to fix it
      const cleanPath = importPath.trim();
      if (cleanPath.startsWith('../') || cleanPath.startsWith('./')) {
        importFixed = true;
        return `import "${cleanPath}";`;
      }
    }
    return match;
  });

  // Ensure all relative imports have .mjs extension
  content = content.replace(
    /from\s+['"](\.\.?\/[^'"]+?)['"](?!['"]*\.m?js)/g,
    (match, importPath) => {
      const fullPath = path.resolve(path.dirname(filePath), importPath);
      const mjsPath = fullPath + '.mjs';
      const jsPath = fullPath + '.js';

      if (fs.existsSync(mjsPath)) {
        importFixed = true;
        return match.replace(importPath, importPath + '.mjs');
      } else if (fs.existsSync(jsPath)) {
        importFixed = true;
        return match.replace(importPath, importPath + '.js');
      }
      return match;
    }
  );

  // Fix import statements without 'from' keyword
  content = content.replace(
    /import\s+['"](\.\.?\/[^'"]+?)['"];/g,
    (match, importPath) => {
      const fullPath = path.resolve(path.dirname(filePath), importPath);
      const mjsPath = fullPath + '.mjs';

      if (fs.existsSync(mjsPath)) {
        importFixed = true;
        return match.replace(importPath, importPath + '.mjs');
      }
      return match;
    }
  );

  if (importFixed) {
    fs.writeFileSync(filePath, content, 'utf8');
    const relativePath = path.relative(distDir, filePath);
    changes.push(`Fixed import syntax in ${relativePath}`);
  }
}

// === CORS CONFIGURATION ===
function setupCORS() {
  const hostJsonPath = path.join(__dirname, '..', 'host.json');
  if (fs.existsSync(hostJsonPath)) {
    let hostJson = JSON.parse(fs.readFileSync(hostJsonPath, 'utf8'));

    // Add CORS if not present
    if (!hostJson.cors) {
      hostJson.cors = {
        allowedOrigins: [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'https://localhost:5173',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
        ],
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
        maxAge: 86400,
      };

      fs.writeFileSync(hostJsonPath, JSON.stringify(hostJson, null, 2));
      changes.push('Added CORS configuration to host.json');
    }
  }
}

// === COPY HOST.JSON ===
function copyHostJson() {
  const sourceHostJsonPath = path.join(__dirname, '..', 'host.json');
  const destHostJsonPath = path.join(__dirname, '..', 'dist', 'host.json');

  if (fs.existsSync(sourceHostJsonPath)) {
    fs.copyFileSync(sourceHostJsonPath, destHostJsonPath);
    changes.push('Copied host.json to dist directory');
  }
}

// === MAIN EXECUTION ===
console.log(
  '🔧 Setting up Azure Functions build (ES Modules with .mjs only)...'
);

ensureDirectoriesExist();
setupESModules();
convertFilesToMJS();
setupServiceFiles();
fixImportSyntax();
setupCORS();
copyHostJson();

if (changes.length > 0) {
  console.log('✅ The following changes were made:');
  changes.forEach((change) => console.log(`  - ${change}`));
} else {
  console.log(
    '👍 Build files are up to date - using Azure Functions v4 programming model'
  );
}

// Final verification
const distDir = path.join(__dirname, '..', 'dist');
const mjsFiles = countFilesByExtension(distDir, '.mjs');
const jsFiles = countFilesByExtension(distDir, '.js');

console.log(`📊 Build summary:`);
console.log(`  - .mjs files: ${mjsFiles}`);
console.log(`  - .js files: ${jsFiles} (excluding .js.map)`);

console.log('🚀 Ready to run Azure Functions with ES Modules!');

// === UTILITY FUNCTIONS ===
function countFilesByExtension(dir, ext) {
  let count = 0;

  function countInDirectory(currentDir) {
    if (!fs.existsSync(currentDir)) return;

    const files = fs.readdirSync(currentDir);
    files.forEach((file) => {
      const filePath = path.join(currentDir, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        countInDirectory(filePath);
      } else if (file.endsWith(ext) && !file.endsWith('.js.map')) {
        count++;
      }
    });
  }

  countInDirectory(dir);
  return count;
}
