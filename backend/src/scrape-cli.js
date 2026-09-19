import { scrapeProduct } from './scraper.js';

const commandLineArgs = process.argv.slice(2);
const showBrowser = commandLineArgs.includes('--headed');
const productIdText = commandLineArgs.find((argument) => /^\d+$/.test(argument));
const productId = productIdText ? Number(productIdText) : 738;

try {
  const reading = await scrapeProduct(productId, {
    headed: showBrowser,
    onAttempt: (entry) => console.error(JSON.stringify(entry)),
  });
  console.log(JSON.stringify(reading, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
