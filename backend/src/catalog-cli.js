import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, searchCatalog } from './catalog.js';

const catalogFile = resolve(dirname(fileURLToPath(import.meta.url)), '../data/catalog.json');
const commandLineArgs = process.argv.slice(2);

try {
  if (commandLineArgs[0] === '--sync') {
    const products = await loadCatalog((message) => console.error(message));
    await mkdir(dirname(catalogFile), { recursive: true });
    await writeFile(
      catalogFile,
      JSON.stringify({ refreshedAt: new Date().toISOString(), products }, null, 2),
    );
    console.log(`Saved ${products.length} products to ${catalogFile}`);
  } else if (commandLineArgs[0] === '--search') {
    const query = commandLineArgs.slice(1).join(' ');
    const { products } = JSON.parse(await readFile(catalogFile, 'utf8'));
    console.log(JSON.stringify(searchCatalog(products, query), null, 2));
  } else {
    throw new Error('Use --sync or --search <partial product name>');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
