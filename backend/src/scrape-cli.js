import { scrapeProduct } from './scraper.js';

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const idArgument = args.find((arg) => /^\d+$/.test(arg));
const productId = idArgument ? Number(idArgument) : 738;

try {
  const reading = await scrapeProduct(productId, {
    headed,
    onAttempt: (entry) => console.error(JSON.stringify(entry)),
  });
  console.log(JSON.stringify(reading, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
