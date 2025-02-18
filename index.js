require('dotenv').config();
require('colors');
const { loadNetworkConfig, delay } = require('./src/utils');
const { deployContract } = require('./src/deploy');
const readlineSync = require('readline-sync');
const tokenNames = require('./tokenNames.json');
const adjectives = tokenNames.adjectives;
const nouns = tokenNames.nouns;
const privateKeys = process.env.PRIVATE_KEYS
  ? process.env.PRIVATE_KEYS.split(',').map(key => key.trim())
  : [];

function generateTokenName() {
  const template = Math.floor(Math.random() * 4);
  let name = "";
  switch (template) {
    case 0:
      name =
        adjectives[Math.floor(Math.random() * adjectives.length)] +
        ' ' +
        nouns[Math.floor(Math.random() * nouns.length)];
      break;
    case 1:
      name =
        nouns[Math.floor(Math.random() * nouns.length)] +
        ' ' +
        adjectives[Math.floor(Math.random() * adjectives.length)];
      break;
    case 2:
      name =
        adjectives[Math.floor(Math.random() * adjectives.length)] +
        ' ' +
        adjectives[Math.floor(Math.random() * adjectives.length)] +
        ' ' +
        nouns[Math.floor(Math.random() * nouns.length)];
      break;
    case 3:
      name =
        nouns[Math.floor(Math.random() * nouns.length)] +
        ' ' +
        nouns[Math.floor(Math.random() * nouns.length)];
      break;
    default:
      name = adjectives[0] + ' ' + nouns[0];
  }
  return name;
}

function generateTokenSymbol(tokenName) {
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
  const networkType = process.argv[2] || 'testnet';
  const networks = loadNetworkConfig(networkType);
  console.log(`Available networks:`.yellow);
  networks.forEach((network, index) => {
    console.log(`${index + 1}. ${network.name}`);
  });
  const networkInput = readlineSync.question('\nSelect networks (enter numbers separated by comma): '.cyan);
  const indices = networkInput.split(',').map(item => parseInt(item.trim()) - 1);
  let selectedNetworks = indices.map(index => networks[index]).filter(Boolean);
  if (selectedNetworks.length === 0) {
    console.error('No valid network selected'.red);
    process.exit(1);
  }
  let networkDeployments = selectedNetworks.map(network => ({
    network,
    keys: [...privateKeys]
  }));
  console.log('\nStarting deployment process. Each private key will attempt to deploy on each network until it runs out of funds.\n'.yellow);
  let iteration = 1;
  while (networkDeployments.length > 0) {
    console.log(`\nIteration: ${iteration}`);
    let nextRoundDeployments = [];
    for (let nd of networkDeployments) {
      const { network, keys } = nd;
      let activeKeys = [];
      let networkErrorOccurred = false;
      for (let key of keys) {
        if (networkErrorOccurred) break;
        const tokenName = generateTokenName();
        const tokenSymbol = generateTokenSymbol(tokenName);
        const tokenSupply = Math.floor(Math.random() * (10000000 - 1000000 + 1)) + 1000000;
        console.log(`\nDeploying on ${network.name} with key ${key.substring(0, 4)}...`);
        console.log(`Token Name: ${tokenName}`);
        console.log(`Token Symbol: ${tokenSymbol}`);
        console.log(`Token Supply: ${tokenSupply}`);
        try {
          const contractAddress = await deployContract(
            network,
            tokenName,
            tokenSymbol,
            tokenSupply,
            key
          );
          console.log(`Deployment successful on ${network.name} with key ${key.substring(0, 4)}! Contract Address: ${contractAddress}`);
          activeKeys.push(key);
        } catch (error) {
          console.error(`Error deploying on ${network.name} with key ${key.substring(0, 4)}:`, error);
          if (error.message && error.message.toLowerCase().includes('insufficient funds')) {
            console.error(`Key ${key.substring(0, 4)} on network ${network.name} halted due to insufficient funds.`);
          } else {
            console.error(`Non-fund related error occurred on network ${network.name} with key ${key.substring(0, 4)}. Stopping deployment on this network.`);
            networkErrorOccurred = true;
            break;
          }
        }
        const randomDelay = Math.floor(Math.random() * (30000 - 15000 + 1)) + 15000;
        console.log(`Waiting for ${randomDelay / 1000} seconds before next deployment attempt on ${network.name}...`.cyan);
        await delay(randomDelay);
      }
      if (!networkErrorOccurred && activeKeys.length > 0) {
        nextRoundDeployments.push({ network, keys: activeKeys });
      } else if (networkErrorOccurred) {
        console.log(`Deployment halted on network ${network.name} due to error.`.red);
      } else {
        console.log(`All private keys on network ${network.name} have insufficient funds.`.red);
      }
    }
    if (nextRoundDeployments.length === 0) {
      console.log('\nAll networks have halted deployment due to insufficient funds or errors on all private keys.'.red);
      break;
    }
    networkDeployments = nextRoundDeployments;
    iteration++;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
