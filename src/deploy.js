require('colors');
const ethers = require('ethers');
const { generateContractCode } = require('./contractCode');

async function deployContract(network, name, symbol, supply, privateKey) {
  try {
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    // Gunakan privateKey yang diberikan; jika tidak ada, fallback ke process.env.PRIVATE_KEY
    const wallet = new ethers.Wallet(privateKey || process.env.PRIVATE_KEY, provider);

    console.log(`\nDeploying contract to ${network.name}...`.yellow);

    const { bytecode, abi } = generateContractCode(name, symbol, supply);
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy();

    console.log(`\nContract deployed successfully!`.green);
    console.log(`Contract address: ${contract.target}`.cyan);
    console.log(
      `Explorer URL: ${network.explorer}/address/${contract.target}`.blue
    );

    return contract.target;
  } catch (error) {
    console.error(`Error deploying contract: ${error.message}`.red);
    throw error;
  }
}

module.exports = { deployContract };
