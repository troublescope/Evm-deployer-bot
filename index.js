require('dotenv').config();
require('colors');
const { loadNetworkConfig, delay } = require('./src/utils');
const { deployContract } = require('./src/deploy');
const readlineSync = require('readline-sync');

// Memuat daftar kata dari file JSON (tokenNames.json)
const tokenNames = require('./tokenNames.json');
const adjectives = tokenNames.adjectives;
const nouns = tokenNames.nouns;

/**
 * Menghasilkan nama token secara acak dengan beberapa template dan menambahkan spasi antar kata:
 * 1. adjective + noun, contoh: "Crypto Coin"
 * 2. noun + adjective, contoh: "Token Digital"
 * 3. adjective + adjective + noun, contoh: "Meta Hyper Coin"
 * 4. noun + noun, contoh: "Market Exchange"
 */
function generateTokenName() {
  const template = Math.floor(Math.random() * 4);
  let name = "";
  switch (template) {
    case 0:
      name = adjectives[Math.floor(Math.random() * adjectives.length)] + ' ' +
             nouns[Math.floor(Math.random() * nouns.length)];
      break;
    case 1:
      name = nouns[Math.floor(Math.random() * nouns.length)] + ' ' +
             adjectives[Math.floor(Math.random() * adjectives.length)];
      break;
    case 2:
      name = adjectives[Math.floor(Math.random() * adjectives.length)] + ' ' +
             adjectives[Math.floor(Math.random() * adjectives.length)] + ' ' +
             nouns[Math.floor(Math.random() * nouns.length)];
      break;
    case 3:
      name = nouns[Math.floor(Math.random() * nouns.length)] + ' ' +
             nouns[Math.floor(Math.random() * nouns.length)];
      break;
    default:
      name = adjectives[0] + ' ' + nouns[0];
  }
  return name;
}

/**
 * Menghasilkan simbol token berdasarkan nama token.
 * Simbol dihasilkan dengan menghapus spasi terlebih dahulu, kemudian:
 * - Jika random < 0.5, ambil huruf kapital (maksimal 4 karakter).
 * - Jika tidak, ambil 4 huruf pertama (setelah menghapus non-huruf) dalam bentuk uppercase.
 */
function generateTokenSymbol(tokenName) {
  // Hapus spasi dari nama token
  tokenName = tokenName.replace(/\s+/g, '');
  if (Math.random() < 0.5) {
    let symbol = (tokenName.match(/[A-Z]/g) || []).join('');
    if (symbol.length === 0) {
      symbol = tokenName.slice(0, 4).toUpperCase();
    } else if (symbol.length > 4) {
      symbol = symbol.slice(0, 4);
    }
    return symbol;
  } else {
    const lettersOnly = tokenName.replace(/[^A-Za-z]/g, '');
    return lettersOnly.slice(0, 4).toUpperCase();
  }
}

async function main() {
  console.log('======================================'.green);
  console.log('        EVM Auto Deploy Tool         '.green.bold);
  console.log('======================================\n'.green);
  console.log('Please wait...\n'.yellow);
  await delay(3000);
  console.log('Welcome to EVM Auto Deploy!'.green.bold);

  // Load konfigurasi network (default: 'testnet' atau sesuai argumen)
  const networkType = process.argv[2] || 'testnet';
  const networks = loadNetworkConfig(networkType);

  console.log(`Available networks:`.yellow);
  networks.forEach((network, index) => {
    console.log(`${index + 1}. ${network.name}`);
  });

  // Prompt multi-network: masukkan nomor network yang diinginkan, dipisahkan koma
  const networkInput = readlineSync.question('\nSelect networks (enter numbers separated by comma): '.cyan);
  const indices = networkInput.split(',').map(item => parseInt(item.trim()) - 1);
  let activeNetworks = indices.map(index => networks[index]).filter(Boolean);

  if (activeNetworks.length === 0) {
    console.error('No valid network selected'.red);
    process.exit(1);
  }

  console.log('\nStarting deployment process. Deployment will continue until a network runs out of funds.\n'.yellow);

  let iteration = 1;
  while (activeNetworks.length > 0) {
    console.log(`\nIteration: ${iteration}`);
    const networksRemaining = [];
    
    for (let network of activeNetworks) {
      // Generate parameter token secara acak dan variatif
      const tokenName = generateTokenName();
      const tokenSymbol = generateTokenSymbol(tokenName);
      // Supply acak antara 1.000.000 dan 10.000.000
      const tokenSupply = Math.floor(Math.random() * (10000000 - 1000000 + 1)) + 1000000;

      console.log(`\nDeploying on ${network.name}:`);
      console.log(`Token Name: ${tokenName}`);
      console.log(`Token Symbol: ${tokenSymbol}`);
      console.log(`Token Supply: ${tokenSupply}`);

      try {
        const contractAddress = await deployContract(network, tokenName, tokenSymbol, tokenSupply);
        console.log(`Deployment successful on ${network.name}! Contract Address: ${contractAddress}`);
        // Jika deploy berhasil, network tetap aktif untuk iterasi berikutnya
        networksRemaining.push(network);
      } catch (error) {
        console.error(`Error deploying on ${network.name}:`, error);
        // Jika error karena insufficient funds, network tersebut dihentikan
        if (error.message && error.message.toLowerCase().includes('insufficient funds')) {
          console.error(`Deployment halted on ${network.name} due to insufficient funds.`);
        } else {
          console.error(`Non-fund related error occurred on ${network.name}, continuing deployment on this network.`);
          networksRemaining.push(network);
        }
      }

      // Delay acak antara 15-30 detik sebelum deploy berikutnya pada network yang sama
      const randomDelay = Math.floor(Math.random() * (30000 - 15000 + 1)) + 15000;
      console.log(`Waiting for ${randomDelay / 1000} seconds before next deployment on ${network.name}...`.cyan);
      await delay(randomDelay);
    }
    
    if (networksRemaining.length === 0) {
      console.log('\nAll selected networks have halted deployment due to insufficient funds.'.red);
      break;
    }
    activeNetworks = networksRemaining;
    iteration++;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
