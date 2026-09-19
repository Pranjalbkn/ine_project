import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, searchCatalog } from './catalog.js';

const cache = resolve(dirname(fileURLToPath(import.meta.url)), '../data/catalog.json');
const args = process.argv.slice(2);

try {
  if (args[0] === '--sync') {
    const products = await loadCatalog((message) => console.error(message));
    await mkdir(dirname(cache), { recursive: true });
    await writeFile(cache, JSON.stringify({ refreshedAt: new Date().toISOString(), products }, null, 2));
    console.log(`Saved ${products.length} products to ${cache}`);
  } else if (args[0] === '--search') {
    const query = args.slice(1).join(' ');
    const { products } = JSON.parse(await readFile(cache, 'utf8'));
    console.log(JSON.stringify(searchCatalog(products, query), null, 2));
  } else {
    throw new Error('Use --sync or --search <partial product name>');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
