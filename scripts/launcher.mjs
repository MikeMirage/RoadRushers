import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { access, chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const repository = 'MikeMirage/RoadRushers';
const api = `https://api.github.com/repos/${repository}`;
const playLauncher = 'Jugar RoadRushers.command';

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

function cleanText(value) {
  return String(value).replace(/[\x00-\x1f\x7f-\x9f]/g, ' ');
}

async function openUrl(url, reveal = false) {
  if (process.env.ROADRUSHERS_NO_OPEN === '1') return;
  try { await run('open', reveal ? ['-R', url] : [url]); }
  catch { console.log(`Abre manualmente: ${url}`); }
}

function installDependencies() {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['ci', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(
      `No se pudieron instalar las dependencias (${signal || code}). Comprueba la conexión y vuelve a abrir el lanzador.`,
    )));
  });
}

async function play({ mobile = false } = {}) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (!(major > 22 || major === 22 && minor >= 12 || major === 20 && minor >= 19)) {
    throw new Error('Esta versión necesita Node.js 20.19+ o 22.12+. Se recomienda Node.js 24 LTS: https://nodejs.org');
  }
  console.log('\nRoadRushers · versión actual de esta carpeta');
  console.log(root);
  const lock = await readFile(path.join(root, 'package-lock.json'));
  const stamp = path.join(root, 'node_modules/.roadrushers-launcher-lock');
  const fingerprint = createHash('sha256').update(lock).update(process.versions.node).update(process.platform).update(process.arch).digest('hex');
  const previous = await readFile(stamp, 'utf8').catch(() => '');
  if (previous !== fingerprint || !await exists(path.join(root, 'node_modules/vite/package.json'))) {
    console.log('\nPreparando dependencias. La primera vez puede tardar unos minutos…');
    await installDependencies();
    await writeFile(stamp, fingerprint);
  }
  const require = createRequire(path.join(root, 'package.json'));
  const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
  const server = await createServer({
    root,
    clearScreen: false,
    server: { host: mobile ? '0.0.0.0' : '127.0.0.1', port: 5174, strictPort: false, open: false,
      watch: { ignored: ['**/artifacts/**', '**/versiones/**'] } },
  });
  const stop = async () => { await server.close(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  await server.listen();
  const url = server.resolvedUrls.local[0];
  console.log(`\nJuego listo: ${url}`);
  if (mobile) {
    const addresses = server.resolvedUrls.network;
    console.log('\nMóvil: conecta el teléfono al mismo Wi-Fi que este ordenador.');
    if (addresses.length) {
      console.log('Abre una de estas direcciones en Safari o Chrome del móvil:');
      for (const address of addresses) console.log(`  ${address}`);
    } else {
      console.log('No se ha detectado una dirección de red. Conecta el ordenador al Wi-Fi y vuelve a abrir el lanzador.');
    }
  }
  console.log('Deja esta ventana abierta mientras juegas. Pulsa Ctrl+C para detener el juego.\n');
  await openUrl(url);
}

async function github(endpoint) {
  let response;
  try {
    response = await fetch(`${api}/${endpoint}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'RoadRushers-launcher' },
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error('No se puede conectar con GitHub. Comprueba la conexión a Internet e inténtalo de nuevo.');
  }
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      throw new Error('GitHub ha limitado las consultas. Espera unos minutos e inténtalo de nuevo.');
    }
    throw new Error(`GitHub respondió ${response.status}. Comprueba que la versión existe en ${repository}.`);
  }
  return response.json();
}

async function chooseVersion(rl) {
  console.log('\nConsultando versiones de GitHub…');
  const [commits, tags] = await Promise.all([
    github('commits?sha=main&per_page=20'),
    github('tags?per_page=20'),
  ]);
  const options = [
    { ref: 'main', label: 'Última versión publicada en main' },
    ...tags.map(tag => ({ ref: tag.commit.sha, label: `Etiqueta ${cleanText(tag.name)}` })),
    ...commits.map(commit => ({
      ref: commit.sha,
      label: `${commit.commit.committer.date.slice(0, 10)} · ${commit.sha.slice(0, 8)} · ${cleanText(commit.commit.message.split('\n')[0])}`,
    })),
  ];
  console.log('\nRoadRushers · descargar versiones\n');
  options.forEach((option, index) => console.log(`  ${index + 1}. ${option.label}`));
  console.log('\nTambién puedes escribir una etiqueta, rama o SHA de otra versión.');
  for (;;) {
    const answer = (await rl.question('\nVersión [1 = última; q = salir]: ')).trim();
    if (answer.toLowerCase() === 'q') return null;
    if (!answer) return options[0].ref;
    if (/^\d+$/.test(answer)) {
      const option = options[Number(answer) - 1];
      if (option) return option.ref;
      console.log('Elige un número de la lista.');
    } else return answer;
  }
}

// Validate before extracting: archives must have one top-level directory and
// cannot write outside the temporary download folder.
export function validateArchiveEntries(listing) {
  const entries = listing.split('\n').filter(Boolean);
  const top = entries[0]?.split('/')[0];
  if (!top || entries.some(entry => entry.startsWith('/') || entry.includes('\\') ||
    entry.split('/').includes('..') || entry.split('/')[0] !== top)) {
    throw new Error('El ZIP recibido no tiene una estructura válida.');
  }
  return top;
}

async function download(ref) {
  const commit = await github(`commits/${encodeURIComponent(ref)}`);
  if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error('GitHub devolvió un identificador de versión inválido.');
  const date = commit.commit.committer.date.slice(0, 10);
  const versions = path.join(root, 'versiones');
  const destination = path.join(versions, `RoadRushers-${date}-${commit.sha.slice(0, 12)}`);
  if (await exists(destination)) {
    console.log(`\nEsta versión ya está descargada: ${destination}`);
    await openUrl(path.join(destination, playLauncher), true);
    return;
  }
  await mkdir(versions, { recursive: true });
  const temporary = await mkdtemp(path.join(versions, '.descarga-'));
  try {
    const archive = path.join(temporary, 'version.zip');
    const url = `https://codeload.github.com/${repository}/zip/${commit.sha}`;
    console.log(`\nDescargando ${commit.sha.slice(0, 12)} · ${cleanText(commit.commit.message.split('\n')[0])}…`);
    await new Promise((resolve, reject) => {
      const child = spawn('curl', ['--fail', '--location', '--show-error', process.stderr.isTTY ? '--progress-bar' : '--silent', '--retry', '2',
        '--connect-timeout', '15', '--max-time', '600', '--output', archive, url], { stdio: 'inherit' });
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve() : reject(new Error(`La descarga falló (${code}). Vuelve a intentarlo.`)));
    });
    const { stdout } = await run('unzip', ['-Z1', archive], { maxBuffer: 16 * 1024 * 1024 });
    const folder = validateArchiveEntries(stdout);
    await run('unzip', ['-q', archive, '-d', path.join(temporary, 'extraido')]);
    const extracted = path.join(temporary, 'extraido', folder);
    // Reject symlinks before copying launchers or installing anything.
    async function checkFiles(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) throw new Error('El ZIP contiene enlaces simbólicos inesperados.');
        if (entry.isDirectory()) await checkFiles(path.join(directory, entry.name));
      }
    }
    await checkFiles(extracted);
    for (const file of ['package.json', 'package-lock.json', 'index.html']) {
      if (!await exists(path.join(extracted, file))) throw new Error(`Esta versión no contiene ${file} y no se puede preparar.`);
    }
    await mkdir(path.join(extracted, 'scripts'), { recursive: true });
    for (const file of [playLauncher, 'scripts/launcher.sh', 'scripts/launcher.mjs']) {
      await copyFile(path.join(root, file), path.join(extracted, file));
    }
    await chmod(path.join(extracted, playLauncher), 0o755);
    await chmod(path.join(extracted, 'scripts/launcher.sh'), 0o755);
    await writeFile(path.join(extracted, 'VERSION-DESCARGADA.json'), JSON.stringify({
      repository, ref, commit: commit.sha, date: commit.commit.committer.date,
      description: commit.commit.message, downloadedAt: new Date().toISOString(),
    }, null, 2) + '\n');
    await rename(extracted, destination);
    console.log(`\nVersión guardada en:\n${destination}`);
    console.log(`\nPara jugar, abre «${playLauncher}» dentro de esa carpeta.`);
    await openUrl(path.join(destination, playLauncher), true);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'play') {
    if (args.some(arg => arg !== '--mobile')) throw new Error('Uso: Jugar RoadRushers.command [--mobile]');
    return play({ mobile: args.includes('--mobile') });
  }
  if (mode !== 'download') throw new Error('Usa uno de los lanzadores de la carpeta principal.');
  if (args[0] === '--ref' && args[1]) return download(args[1]);
  if (args.length) throw new Error('Uso: Descargar versiones.command [--ref main|etiqueta|SHA]');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ref = await chooseVersion(rl);
    if (ref) await download(ref);
  } finally { rl.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`\n${error.message}`); process.exitCode = 1; });
}
