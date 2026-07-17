import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, 'package.json');
const versionTsPath = path.join(__dirname, 'src', 'version.ts');

try {
  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  let currentVersion = packageJson.version || '1.0.0';
  
  // If version is 0.0.0, let's start at 1.0.0
  if (currentVersion === '0.0.0') {
    currentVersion = '1.0.0';
  } else {
    // Parse version parts
    const parts = currentVersion.split('.').map(Number);
    if (parts.length === 3 && parts.every(n => !isNaN(n))) {
      parts[2] += 1; // Bump patch version
      currentVersion = parts.join('.');
    } else {
      currentVersion = '1.0.0';
    }
  }
  
  // Update package.json
  packageJson.version = currentVersion;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  
  // Generate src/version.ts
  const buildDate = new Date();
  const formattedDate = buildDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  }) + ' ' + buildDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });

  const versionFileContent = `// Gerado automaticamente durante o build. Não modifique manualmente.
export const APP_VERSION = "${currentVersion}";
export const BUILD_DATE = "${formattedDate}";
`;
  
  fs.writeFileSync(versionTsPath, versionFileContent, 'utf8');
  console.log(`[Version Bump] Versão atualizada para v${currentVersion}`);
} catch (error) {
  console.error('Erro ao atualizar a versão:', error);
}
