/**
 * setup-functions.cjs
 *
 * Azure Functions build setup script that handles:
 * - Directory structure creation for dist folder
 * - ES module configuration
 * - File extension conversion (.js to .mjs)
 * - Import statement fixes
 * - Service file copying
 * - CORS configuration
 * - Production-ready build for Azure Static Web Apps
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
  const packageJsonPath = path.join(__dirname, '..', 'dist', 'package.json'); // Production-ready Azure Functions package.json for Azure SWA
  const esmPackage = {
    name: 'virpal-app-functions',
    version: '1.0.0',
    description:
      'Azure Functions for VirPal App - Node.js 20 & Functions v4 Production Azure SWA',
    type: 'module',
    main: 'index.mjs',
    engines: {
      node: '~20',
    },
    scripts: {
      start: 'func start --cors "*"',
      build: 'echo "Production build for Azure SWA"',
      test: 'echo "Error: no test specified" && exit 1',
    },
    dependencies: {
      '@azure/functions': '^4.7.2',
      '@azure/identity': '^4.10.0',
      '@azure/keyvault-secrets': '^4.9.0',
      jsonwebtoken: '^9.0.2',
      'jwks-rsa': '^3.1.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
    },
    optionalDependencies: {},
    peerDependencies: {},
  };

  if (
    !fs.existsSync(packageJsonPath) ||
    JSON.stringify(JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))) !==
      JSON.stringify(esmPackage)
  ) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(esmPackage, null, 2));
    changes.push(
      'Updated dist/package.json with ES module config for production'
    );
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
    let hostJson = JSON.parse(fs.readFileSync(hostJsonPath, 'utf8')); // Add CORS if not present
    if (!hostJson.cors) {
      hostJson.cors = {
        allowedOrigins: [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'https://localhost:5173',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'https://ashy-coast-0aeebe10f.6.azurestaticapps.net',
        ],
        allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
        maxAge: 86400,
        supportCredentials: true,
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

// === UPDATE API PACKAGE.JSON (Legacy - replaced by updateApiPackageJsonForJs) ===
// This function is kept for backward compatibility but replaced in main execution

// === VALIDATION FOR PRODUCTION (Azure handles all runtime) ===
function validateProductionDependencies() {
  const distPackagePath = path.join(__dirname, '..', 'dist', 'package.json');

  console.log('📦 Validating production dependencies in dist folder...');

  try {
    if (fs.existsSync(distPackagePath)) {
      const packageContent = JSON.parse(
        fs.readFileSync(distPackagePath, 'utf8')
      );
      const requiredDeps = [
        '@azure/functions',
        '@azure/identity',
        '@azure/keyvault-secrets',
      ];

      const missingDeps = requiredDeps.filter(
        (dep) => !packageContent.dependencies[dep]
      );

      if (missingDeps.length === 0) {
        changes.push(
          'All required dependencies are present in dist/package.json'
        );
        console.log(
          '✅ All required dependencies validated - Azure runtime handles execution'
        );
        console.log(
          '✅ No Azure Functions Core Tools in production - saves ~200MB space'
        );
      } else {
        console.warn('⚠️ Missing dependencies:', missingDeps.join(', '));
        changes.push(
          'Warning: Missing dependencies: ' + missingDeps.join(', ')
        );
      }
    } else {
      console.error('❌ dist/package.json not found');
      changes.push('Error: dist/package.json not found');
    }
  } catch (error) {
    console.error('❌ Failed to validate dependencies:', error.message);
    changes.push('Failed to validate dependencies: ' + error.message);
  }
}

// === MAIN EXECUTION ===
console.log(
  '� Setting up Azure Functions build (ES Modules with .mjs for Azure Static Web Apps)...'
);

ensureDirectoriesExist();
setupESModules();
convertFilesToMJS();
setupServiceFiles();
fixImportSyntax();
setupCORS();
copyHostJson();

validateProductionDependencies();

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

// Simple file count for dist directory
let mjsFiles = 0;
let jsFiles = 0;

if (fs.existsSync(distDir)) {
  const distFiles = fs.readdirSync(distDir, { recursive: true });
  mjsFiles = distFiles.filter((file) => file.endsWith('.mjs')).length;
  jsFiles = distFiles.filter(
    (file) => file.endsWith('.js') && !file.endsWith('.js.map')
  ).length;
}

console.log(`📊 Build summary:`);
console.log(`  - Dist .mjs files: ${mjsFiles}`);
console.log(`  - Dist .js files: ${jsFiles} (excluding .js.map)`);

console.log(
  '🚀 Ready to deploy Azure Functions directly from dist folder to Azure Static Web Apps!'
);
