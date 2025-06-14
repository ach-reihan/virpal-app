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
  const apiPackagePath = path.join(__dirname, '..', 'api', 'package.json');

  console.log('📦 Validating production dependencies in api folder...');

  try {
    if (fs.existsSync(apiPackagePath)) {
      const packageContent = JSON.parse(
        fs.readFileSync(apiPackagePath, 'utf8')
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
          'All required dependencies are present in api/package.json'
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
      console.error('❌ api/package.json not found');
      changes.push('Error: api/package.json not found');
    }
  } catch (error) {
    console.error('❌ Failed to validate dependencies:', error.message);
    changes.push('Failed to validate dependencies: ' + error.message);
  }
}

// === SYNC DIST TO API FOLDER ===
function syncDistToApi() {
  const distDir = path.join(__dirname, '..', 'dist');
  const apiDir = path.join(__dirname, '..', 'api');

  console.log('🔄 Syncing dist build output to api folder...');

  // Check if dist directory exists
  if (!fs.existsSync(distDir)) {
    console.warn('⚠️ Dist directory not found - skipping sync');
    return;
  }

  try {
    // Remove existing api directory completely with better error handling
    if (fs.existsSync(apiDir)) {
      // Use recursive remove with force option and retry
      fs.rmSync(apiDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
      changes.push('Removed existing api folder for clean sync');
    }

    // Create new api directory
    fs.mkdirSync(apiDir, { recursive: true });

    // Copy all contents from dist to api recursively
    copyDirectoryRecursive(distDir, apiDir);
    changes.push('Synced all dist build output to api folder');
    console.log('✅ Successfully synced dist to api folder');

    // Log what was copied - simple file count
    const apiFiles = fs.readdirSync(apiDir).filter((item) => {
      const itemPath = path.join(apiDir, item);
      return fs.statSync(itemPath).isFile() && item.endsWith('.mjs');
    });
    console.log(
      `📁 Api folder now contains: ${apiFiles.length} .mjs files at root level`
    );
  } catch (error) {
    console.error('❌ Error syncing dist to api:', error.message);
    changes.push('Warning: Failed to sync dist to api folder');
  }
}

// Helper function to copy directory recursively
function copyDirectoryRecursive(sourceDir, targetDir) {
  // Create target directory if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Read all items in source directory
  const items = fs.readdirSync(sourceDir);

  for (const item of items) {
    const sourcePath = path.join(sourceDir, item);
    const targetPath = path.join(targetDir, item);
    const stats = fs.statSync(sourcePath);

    if (stats.isDirectory()) {
      // Recursively copy subdirectories
      copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      // Copy files
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

// === CONVERT .MJS TO .JS IN API DIRECTORY ===
function convertMjsToJsInApi() {
  const apiDir = path.join(__dirname, '..', 'api');

  if (!fs.existsSync(apiDir)) {
    console.log('⚠️ Api directory not found - skipping .mjs to .js conversion');
    return;
  }

  console.log(
    '🔄 Converting .mjs files to .js in api directory for Azure Functions production...'
  );

  const convertedFiles = [];

  // Recursively convert all .mjs files to .js in api directory
  function convertMjsInDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        convertMjsInDirectory(filePath); // Recursive call for subdirectories
      } else if (file.endsWith('.mjs')) {
        const jsFilePath = filePath.replace(/\.mjs$/, '.js');

        // Read content and update any .mjs imports to .js
        let content = fs.readFileSync(filePath, 'utf8');

        // Update import statements from .mjs to .js
        content = content.replace(
          /from\s+['"](\.\.?\/[^'"]+?)\.mjs['"]/g,
          (match, importPath) => {
            return match.replace('.mjs', '.js');
          }
        );

        content = content.replace(
          /import\s+['"](\.\.?\/[^'"]+?)\.mjs['"]/g,
          (match, importPath) => {
            return match.replace('.mjs', '.js');
          }
        );

        // Write content to new .js file
        fs.writeFileSync(jsFilePath, content);

        // Remove original .mjs file
        fs.unlinkSync(filePath);

        const relativePath = path.relative(apiDir, jsFilePath);
        convertedFiles.push(relativePath);
        changes.push(
          `Converted ${path.relative(apiDir, filePath)} to ${relativePath}`
        );
      }
    });
  }

  convertMjsInDirectory(apiDir);

  if (convertedFiles.length > 0) {
    console.log(
      `✅ Converted ${convertedFiles.length} files from .mjs to .js in api directory`
    );
    changes.push(
      `Successfully converted ${convertedFiles.length} .mjs files to .js in api directory`
    );
  } else {
    console.log('👍 No .mjs files found in api directory to convert');
  }
}

// === UPDATE API PACKAGE.JSON FOR .JS FILES ===
function updateApiPackageJsonForJs() {
  const apiPackageJsonPath = path.join(__dirname, '..', 'api', 'package.json');

  // Production-ready Azure Functions package.json for .js files (not .mjs)
  const apiPackage = {
    name: 'virpal-app-functions',
    version: '1.0.0',
    description:
      'Azure Functions for VirPal App - Node.js 20 & Functions v4 Production Azure SWA',
    type: 'module',
    main: 'index.js', // Changed from index.mjs to index.js
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

  const apiDir = path.join(__dirname, '..', 'api');
  if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir, { recursive: true });
  }

  // Write the updated package.json
  fs.writeFileSync(apiPackageJsonPath, JSON.stringify(apiPackage, null, 2));
  changes.push(
    'Updated api/package.json with main: "index.js" for production Azure Functions'
  );
  console.log(
    '✅ Updated api/package.json to use .js files (main: "index.js")'
  );
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
syncDistToApi();

// New functions for API directory (.js conversion for Azure Functions production)
console.log(
  '🔄 Converting API files from .mjs to .js for Azure Functions production...'
);
convertMjsToJsInApi();
updateApiPackageJsonForJs();

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
const apiDir = path.join(__dirname, '..', 'api');

// Simple file count without external function
let mjsFiles = 0;
let jsFiles = 0;
let apiJsFiles = 0;

if (fs.existsSync(distDir)) {
  const distFiles = fs.readdirSync(distDir, { recursive: true });
  mjsFiles = distFiles.filter((file) => file.endsWith('.mjs')).length;
  jsFiles = distFiles.filter(
    (file) => file.endsWith('.js') && !file.endsWith('.js.map')
  ).length;
}

if (fs.existsSync(apiDir)) {
  const apiFiles = fs.readdirSync(apiDir, { recursive: true });
  apiJsFiles = apiFiles.filter(
    (file) => file.endsWith('.js') && !file.endsWith('.js.map')
  ).length;
}

console.log(`📊 Build summary:`);
console.log(`  - Dist .mjs files: ${mjsFiles}`);
console.log(`  - Dist .js files: ${jsFiles} (excluding .js.map)`);
console.log(`  - API .js files: ${apiJsFiles} (production ready)`);

console.log(
  '🚀 Ready to deploy Azure Functions with .js files for production!'
);

// === CONVERT MJS TO JS IN API DIRECTORY (Production Azure Functions) ===
function convertMjsToJsInApi() {
  const apiDir = path.join(__dirname, '..', 'api');

  if (!fs.existsSync(apiDir)) {
    console.warn(
      '⚠️ API directory not found - skipping .mjs to .js conversion'
    );
    return;
  }

  console.log(
    '🔄 Converting .mjs files to .js in API directory for Azure Functions production...'
  );

  function convertInDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        convertInDirectory(filePath); // Recursive call for subdirectories
      } else if (file.endsWith('.mjs')) {
        const jsFilePath = filePath.replace(/\.mjs$/, '.js');

        // Read content and update import statements
        let content = fs.readFileSync(filePath, 'utf8');

        // Update import statements to use .js extensions instead of .mjs
        content = content.replace(
          /from\s+['"](\.\.?\/[^'"]+?)\.mjs['"]/g,
          (match, importPath) => {
            return match.replace('.mjs', '.js');
          }
        );

        content = content.replace(
          /import\s+['"](\.\.?\/[^'"]+?)\.mjs['"]/g,
          (match, importPath) => {
            return match.replace('.mjs', '.js');
          }
        );

        // Write to .js file
        fs.writeFileSync(jsFilePath, content);

        // Remove .mjs file
        fs.unlinkSync(filePath);

        const relativePath = path.relative(apiDir, jsFilePath);
        changes.push(
          `Converted ${file} to ${path.basename(jsFilePath)} in API directory`
        );
      }
    });
  }

  convertInDirectory(apiDir);
  console.log('✅ Converted all .mjs files to .js in API directory');
}

// === UPDATE API PACKAGE.JSON FOR .JS FILES ===
function updateApiPackageJsonForJs() {
  const apiPackageJsonPath = path.join(__dirname, '..', 'api', 'package.json');

  // Production-ready Azure Functions package.json for .js files (not .mjs)
  const apiPackage = {
    name: 'virpal-app-functions',
    version: '1.0.0',
    description:
      'Azure Functions for VirPal App - Node.js 20 & Functions v4 Production Azure SWA',
    type: 'module',
    main: 'index.js', // Changed from index.mjs to index.js
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

  const apiDir = path.join(__dirname, '..', 'api');
  if (!fs.existsSync(apiDir)) {
    fs.mkdirSync(apiDir, { recursive: true });
  }

  fs.writeFileSync(apiPackageJsonPath, JSON.stringify(apiPackage, null, 2));
  changes.push('Updated api/package.json for .js files (main: index.js)');
  console.log('✅ Updated api/package.json for .js files');
}
