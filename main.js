import 'dotenv/config';
import fs from 'fs';
import inquirer from 'inquirer';
import { ethers } from 'ethers';
import solc from 'solc';
import chalk from 'chalk';
import { printBanner } from './utils/banner.js';
import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);

const rpcUrls = (process.env.RPC_URL ||
  "https://tea-sepolia.g.alchemy.com/public")
  .split(",")
  .map(url => url.trim());

let stableProviderCache = { provider: null, timestamp: 0 };

async function selectStableProvider() {
  const cacheDuration = 60000; // 60 seconds
  const nowTime = Date.now();
  if (stableProviderCache.provider && nowTime - stableProviderCache.timestamp < cacheDuration) {
    return stableProviderCache.provider;
  }
  let bestProvider = null;
  let bestLatency = Infinity;
  for (const url of rpcUrls) {
    try {
      const provider = new ethers.providers.JsonRpcProvider(url);
      const start = Date.now();
      const latestBlock = await provider.getBlock("latest");
      const latency = Date.now() - start;
      const now = Math.floor(Date.now() / 1000);
      if (now - latestBlock.timestamp <= 30) {
        if (latency < bestLatency) {
          bestLatency = latency;
          bestProvider = provider;
        }
      } else {
        logWarning(`⏰ RPC ${url} is not synchronized (block time difference ${now - latestBlock.timestamp} seconds).`);
      }
    } catch (error) {
      logWarning(`🚫 RPC ${url} error: ${error.message}`);
    }
  }
  if (!bestProvider) {
    bestProvider = new ethers.providers.JsonRpcProvider(rpcUrls[0]);
    logWarning(`⚠️ No suitable RPC found. Using fallback: ${rpcUrls[0]}`);
  } else {
    logInfo(`📡 Selected stable RPC: ${bestProvider.connection.url} (latency ${bestLatency}ms)`);
  }
  stableProviderCache = { provider: bestProvider, timestamp: nowTime };
  return bestProvider;
}

const baseWallet = new ethers.Wallet(process.env.MAIN_PRIVATE_KEY);
async function getStableWallet() {
  const provider = await selectStableProvider();
  return baseWallet.connect(provider);
}

async function updateHardhatConfig() {

  const configContent = `require("@nomicfoundation/hardhat-verify");

module.exports = {
  solidity: "0.8.28",
  networks: {
    "tea-sepolia": {
      url: "https://tea-sepolia.g.alchemy.com/public",
      chainId: 10218,
      accounts: [process.env.MAIN_PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: {
      "tea-sepolia": process.env.EXPLORER_API_KEY || "empty"
    },
    customChains: [
      {
        network: "tea-sepolia",
        chainId: 10218,
        urls: {
          apiURL: "https://sepolia.tea.xyz/api",
          browserURL: "https://sepolia.tea.xyz/"
        }
      }
    ]
  },
  sourcify: {
    enabled: false
  }
};
`;
  fs.writeFileSync("hardhat.config.cjs", configContent);
  logInfo(`📝 Hardhat config updated with RPC: https://tea-sepolia.g.alchemy.com/public`);
}

const CHAIN_ID = process.env.CHAIN_ID || 10218;
let CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
const EXPLORER_URL = process.env.EXPLORER_URL || "https://sepolia.tea.xyz";
const DAILY_LIMIT = 3500;
let contractInstance = null;

function getTimestamp() {
  return new Date().toLocaleTimeString();
}

function logInfo(message) {
  console.log(chalk.blue(`[${getTimestamp()}]-[info] : ${message}`));
}

function logSuccess(message) {
  console.log(chalk.green(`[${getTimestamp()}]-[success] ✅ : ${message}`));
}

function logWarning(message) {
  console.log(chalk.yellow(`[${getTimestamp()}]-[warning] ⚠️ : ${message}`));
}

function logError(message) {
  console.log(chalk.red(`[${getTimestamp()}]-[error] ❌ : ${message}`));
}

async function promptWithBack(questions) {
  const answers = await inquirer.prompt(questions);
  for (const key in answers) {
    if (typeof answers[key] === 'string' && answers[key].trim().toLowerCase() === 'back') {
      logInfo("🔙 'back' detected. Returning to main menu...");
      return null;
    }
  }
  return answers;
}

function getDailyCounter() {
  const file = 'daily_counter.json';
  const today = new Date().toISOString().slice(0, 10);
  if (fs.existsSync(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.date !== today) {
        return { date: today, count: 0 };
      }
      return data;
    } catch (e) {
      return { date: today, count: 0 };
    }
  }
  return { date: today, count: 0 };
}

function updateDailyCounter(newCount) {
  const today = new Date().toISOString().slice(0, 10);
  const data = { date: today, count: newCount };
  fs.writeFileSync('daily_counter.json', JSON.stringify(data, null, 2));
}

function printSeparator(length = 50) {
  console.log("=".repeat(length));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function monitorNetwork() {
  try {
    const provider = await selectStableProvider();
    const latestBlock = await provider.getBlock("latest");
    const now = Math.floor(Date.now() / 1000);
    if (now - latestBlock.timestamp > 30) {
      logWarning("⚡ Blockchain is not updating quickly.");
      return false;
    }
    const walletInst = await getStableWallet();
    const balance = await walletInst.getBalance();
    const minBalance = ethers.utils.parseEther("0.01");
    if (balance.lt(minBalance)) {
      logWarning("💰 Wallet balance is insufficient.");
      return false;
    }
    return true;
  } catch (error) {
    logError("🚨 Error monitoring network: " + error);
    return false;
  }
}

async function waitForRPCRecovery() {
  while (!(await monitorNetwork())) {
    logWarning("⏳ RPC/network conditions are not normal, waiting 10 seconds...");
    await delay(10000);
  }
}

async function sendTransactionWithRetry(txParams, maxRetries = 3) {
  let attempts = 0;
  let updatedGasPrice = txParams.gasPrice || (await (await selectStableProvider()).getGasPrice());
  while (attempts < maxRetries) {
    try {
      const walletInst = await getStableWallet();
      const currentNonce = await walletInst.getTransactionCount("pending");
      const tx = await walletInst.sendTransaction({
        ...txParams,
        nonce: currentNonce,
        gasPrice: updatedGasPrice
      });
      logInfo(`💸 Tx Hash: ${tx.hash}`);
      if (EXPLORER_URL) {
        logInfo(`🔎 Explorer: ${EXPLORER_URL}/tx/${tx.hash}`);
      }
      logInfo("⏳ Waiting for transaction confirmation...");
      await tx.wait();
      return tx;
    } catch (error) {
      const errMsg = error.message.toLowerCase();
      if (errMsg.includes("nonce") && errMsg.includes("too low")) {
        logWarning("🔄 Nonce is too low, fetching the latest nonce...");
        await delay(5000);
        attempts++;
        continue;
      } else if ((errMsg.includes("fee") || errMsg.includes("gas")) && errMsg.includes("too low")) {
        logWarning("📈 Fee is too low, increasing gas price...");
        const currentGasPrice = await (await selectStableProvider()).getGasPrice();
        updatedGasPrice = currentGasPrice.mul(120).div(100);
        attempts++;
        continue;
      } else if (errMsg.includes("502") || errMsg.includes("gateway") || errMsg.includes("enotfound")) {
        attempts++;
        logWarning(`⚠️ Transaction failed due to server/DNS error. Retrying (${attempts}/${maxRetries})...`);
        await delay(10000);
        continue;
      } else {
        throw error;
      }
    }
  }
  throw new Error("❌ Transaction failed after several attempts.");
}

async function compileContractWithHardhat() {
  logInfo("🛠️ Running Hardhat compilation...");
  try {
    const { stdout } = await execPromise("npx hardhat compile");
    logSuccess("🛠️ Hardhat compilation successful.");
  } catch (error) {
    logError("🛠️ Hardhat compilation failed: " + error);
    throw error;
  }
  const artifactPath = "artifacts/contracts/CustomToken.sol/CustomToken.json";
  if (!fs.existsSync(artifactPath)) {
    throw new Error("📦 Artifact not found: " + artifactPath);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return { abi: artifact.abi, bytecode: artifact.bytecode.object || artifact.bytecode };
}

function getTargetAddresses() {
  const filePath = 'verified_addresses.txt';
  if (!fs.existsSync(filePath)) return [];
  const data = fs.readFileSync(filePath, 'utf8');
  const addresses = data
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line !== '');
  return addresses;
}

function getProcessedAddresses() {
  const file = 'processed_addresses.json';
  const today = new Date().toISOString().slice(0, 10);
  if (fs.existsSync(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.date !== today) {
        return { date: today, addresses: [] };
      }
      return data;
    } catch (e) {
      return { date: today, addresses: [] };
    }
  }
  return { date: today, addresses: [] };
}

function updateProcessedAddresses(newAddress) {
  const file = 'processed_addresses.json';
  const today = new Date().toISOString().slice(0, 10);
  let data = { date: today, addresses: [] };
  if (fs.existsSync(file)) {
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (data.date !== today) {
        data = { date: today, addresses: [] };
      }
    } catch (e) {
      data = { date: today, addresses: [] };
    }
  }
  data.addresses.push(newAddress.toLowerCase());
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function sendNativeToken() {
  const targetAddresses = getTargetAddresses();
  if (targetAddresses.length === 0) {
    logWarning("No addresses found in addresses.txt");
    return;
  }
  const processed = getProcessedAddresses();
  const addressesToProcess = targetAddresses.filter(addr => !processed.addresses.includes(addr.toLowerCase()));

  if (addressesToProcess.length === 0) {
    logInfo("All addresses have been processed for today. Processing will continue tomorrow.");
    return;
  }

  const counter = getDailyCounter();
  const remainingTransactions = DAILY_LIMIT - counter.count;
  if (remainingTransactions <= 0) {
    logError(`Daily limit of ${DAILY_LIMIT} transactions reached. Please try again tomorrow.`);
    return;
  }
  const transactionsToSend = Math.min(remainingTransactions, addressesToProcess.length);

  printSeparator();
  logInfo(`💸 Starting to send ${transactionsToSend} native token transactions to address from verified_addresses.txt...\n`);
  let completed = 0;

  for (let i = 0; i < transactionsToSend; i++) {
    await waitForRPCRecovery();
    const recipient = addressesToProcess[i];
    // Generate a random amount between 0.001 and 0.01 TEA
    const randomAmount = (0.001 + Math.random() * (0.01 - 0.001)).toFixed(4);
    const amount = ethers.utils.parseUnits(randomAmount, 18);
    logInfo(`💸 Transaction ${i + 1}: Sending ${randomAmount} TEA to ${recipient}...`);
    try {
      if (!CONTRACT_ADDRESS) {
        const tx = await sendTransactionWithRetry({ to: recipient, value: amount });
        logSuccess("💸 Transfer successful.");
      } else {
        if (!contractInstance) {
          const { abi } = await compileContractWithHardhat();
          contractInstance = new ethers.Contract(CONTRACT_ADDRESS, abi, await getStableWallet());
        }
        contractInstance = contractInstance.connect(await getStableWallet());
        const contractBalance = await contractInstance.provider.getBalance(contractInstance.address);
        if (contractBalance.gte(amount)) {
          const tx = await contractInstance.sendNative(recipient, amount);
          logInfo(`💸 Tx Hash: ${tx.hash}`);
          if (EXPLORER_URL) {
            logInfo(`🔎 Explorer: ${EXPLORER_URL}/tx/${tx.hash}`);
          }
          logInfo("⏳ Waiting for transaction confirmation...");
          await tx.wait();
          logSuccess("💸 Contract transfer successful.");
        } else {
          logWarning("⚠️ Contract native balance insufficient. Using main wallet...");
          const tx = await sendTransactionWithRetry({ to: recipient, value: amount });
          logSuccess("💸 Transfer successful.");
        }
      }
      completed++;
      const current = getDailyCounter();
      updateDailyCounter(current.count + 1);
      updateProcessedAddresses(recipient);
    } catch (err) {
      logError(`❌ Transfer failed: ${err}`);
    }
    if (i < transactionsToSend - 1) {
      const randomDelay = Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
      logInfo(`⏱️ Waiting ${(randomDelay / 1000).toFixed(2)} seconds before the next transaction...\n`);
      await delay(randomDelay);
      printSeparator();
    }
  }
  logSuccess(`💸 Completed sending ${completed} out of ${transactionsToSend} native token transactions.`);
  await inquirer.prompt([{ type: 'input', name: 'return', message: 'Press "Enter" to return to the main menu...' }]);
}

async function sendERC20Token() {
  if (!CONTRACT_ADDRESS) {
    logError("❌ Contract not deployed. Please deploy the contract first.");
    await delay(5000);
    return;
  }
  if (!contractInstance) {
    const { abi } = await compileContractWithHardhat();
    contractInstance = new ethers.Contract(CONTRACT_ADDRESS, abi, await getStableWallet());
  }
  let deployedSymbol = "";
  try {
    deployedSymbol = await contractInstance.symbol();
  } catch (error) {
    logWarning("⚠️ Failed to retrieve token symbol from the contract; please enter manually.");
  }
  const tokenSymbolPromptMsg = deployedSymbol
    ? `Enter the token symbol to send (deployed contract symbol is ${deployedSymbol}):`
    : "Enter the token symbol to send:";

  const answers = await promptWithBack([
    { type: 'input', name: 'tokenSymbol', message: tokenSymbolPromptMsg },
    {
      type: 'input',
      name: 'amountPerTx',
      message: 'Enter the token amount per transaction (e.g., 0.001):',
      validate: input => {
        if (input.trim().toLowerCase() === 'back') return true;
        if (isNaN(input) || Number(input) <= 0) return 'Must be a valid number';
        return true;
      }
    }
  ]);
  if (answers === null) return;
  const deployedTokenSymbol = await contractInstance.symbol();
  if (deployedTokenSymbol !== answers.tokenSymbol) {
    logError(`❌ Token with symbol ${answers.tokenSymbol} not found. The deployed token is ${deployedTokenSymbol}.`);
    await delay(5000);
    return;
  }
  const tokenDecimals = await contractInstance.decimals();
  const amountPerTxInSmallestUnit = ethers.utils.parseUnits(answers.amountPerTx, tokenDecimals);

  const targetAddresses = getTargetAddresses();
  if (targetAddresses.length === 0) {
    logWarning("No addresses found in verified_addresses.txt");
    return;
  }
  const processed = getProcessedAddresses();
  const addressesToProcess = targetAddresses.filter(addr => !processed.addresses.includes(addr.toLowerCase()));

  if (addressesToProcess.length === 0) {
    logInfo("All addresses have been processed for today. Processing will continue tomorrow.");
    return;
  }

  const counter = getDailyCounter();
  const remainingTransactions = DAILY_LIMIT - counter.count;
  if (remainingTransactions <= 0) {
    logError(`Daily limit of ${DAILY_LIMIT} transactions reached. Please try again tomorrow.`);
    return;
  }
  const totalTx = Math.min(remainingTransactions, addressesToProcess.length);

  printSeparator();
  logInfo(`🪙 Starting to send ${totalTx} ERC20 token transactions to address from verified_addresses.txt...\n`);
  let completed = 0;

  for (let i = 0; i < totalTx; i++) {
    await waitForRPCRecovery();
    const recipient = addressesToProcess[i];
    logInfo(`🪙 Transaction ${i + 1}: Sending tokens to ${recipient}...`);
    try {
      contractInstance = contractInstance.connect(await getStableWallet());
      const tx = await contractInstance.transfer(recipient, amountPerTxInSmallestUnit);
      logInfo(`🪙 Tx Hash: ${tx.hash}`);
      if (EXPLORER_URL) {
        logInfo(`🔎 Explorer: ${EXPLORER_URL}/tx/${tx.hash}`);
      }
      logInfo("⏳ Waiting for transaction confirmation...");
      await tx.wait();
      logSuccess("🪙 Transfer successful.");
      const mainWallet = await getStableWallet();
      const txCount = await mainWallet.getTransactionCount();
      logInfo(`Total tx = ${txCount}`);
      completed++;
      const current = getDailyCounter();
      updateDailyCounter(current.count + 1);
      updateProcessedAddresses(recipient);
    } catch (err) {
      logError(`❌ Transfer failed: ${err}`);
    }
    if (i < totalTx - 1) {
      const randomDelay = Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
      logInfo(`⏱️ Waiting ${(randomDelay / 1000).toFixed(2)} seconds before the next transaction...\n`);
      await delay(randomDelay);
      printSeparator();
    }
  }
  logSuccess(`🪙 Completed sending ${completed} out of ${totalTx} ERC20 token transactions.`);
  await inquirer.prompt([{ type: 'input', name: 'return', message: 'Press "Enter" to return to the main menu...' }]);
}

function updateEnvVariable(key, value) {
  const envPath = '.env';
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  const regex = new RegExp(`^${key}=.*$`, 'm');
  const newLine = `${key}=${value}`;
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, newLine);
  } else {
    envContent += `\n${newLine}`;
  }
  fs.writeFileSync(envPath, envContent);
  logInfo(`📝 .env file updated: ${key}=${value}`);
}

async function deployContract() {
  const answers = await promptWithBack([
    { type: 'input', name: 'name', message: 'Enter Contract Name:' },
    { type: 'input', name: 'symbol', message: 'Enter Contract Symbol:' },
    {
      type: 'input',
      name: 'decimals',
      message: 'Enter Decimals (default 18):',
      validate: input => {
        if (input.trim().toLowerCase() === 'back') return true;
        if (isNaN(input) || Number(input) <= 0) return 'Must be a valid number';
        return true;
      }
    },
    {
      type: 'input',
      name: 'totalSupply',
      message: 'Enter Total Supply (e.g., 100000):',
      validate: input => {
        if (input.trim().toLowerCase() === 'back') return true;
        if (isNaN(input) || Number(input) <= 0) return 'Must be a valid number';
        return true;
      }
    }
  ]);
  if (answers === null) return;
  printSeparator();
  logInfo("🚀 Preparing to deploy contract...");
  const { abi, bytecode } = await compileContractWithHardhat();
  const walletInst = await getStableWallet();
  const factory = new ethers.ContractFactory(abi, bytecode, walletInst);
  const totalSupplyInWei = ethers.utils.parseUnits(answers.totalSupply, Number(answers.decimals));
  logInfo("🚀 Sending deploy transaction...");
  const contract = await factory.deploy(answers.name, answers.symbol, Number(answers.decimals), totalSupplyInWei);
  logInfo(`🚀 Tx Hash: ${contract.deployTransaction.hash}`);
  if (EXPLORER_URL) {
    logInfo(`🔎 Explorer: ${EXPLORER_URL}/tx/${contract.deployTransaction.hash}`);
  }
  logInfo("🚀 Waiting for transaction confirmation (this may take some time)...");
  await contract.deployed();
  logSuccess(`🚀 Contract deployed at address: ${contract.address}`);
  printSeparator();
  contractInstance = contract;
  CONTRACT_ADDRESS = contract.address;
  updateEnvVariable("CONTRACT_ADDRESS", contract.address);
  logInfo("🔍 Automatically verifying contract with Hardhat...");
  await updateHardhatConfig();
  const verified = await verifyContractHardhat(contract.address, [answers.name, answers.symbol, answers.decimals, totalSupplyInWei.toString()]);
  if (!verified) {
    logWarning("🔍 Contract not auto-verified. Please verify manually if necessary.");
  } else {
    logSuccess("🔍 Contract verified successfully.");
  }
  logInfo(`📋 Contract Details:
- Name: ${answers.name}
- Symbol: ${answers.symbol}
- Decimals: ${answers.decimals}
- Total Supply: ${answers.totalSupply} (equivalent to ${totalSupplyInWei.toString()} smallest units)
- Address: ${contract.address}
- Verification Status: ${verified ? "Verified" : "Not Verified"}`);
  await inquirer.prompt([{ type: 'input', name: 'return', message: 'Press "Enter" to return to the main menu...' }]);
}

async function verifyContractHardhat(contractAddress, constructorArgs, maxAttempts = 3) {
  const isInstalled = await ensureHardhatInstalled();
  if (!isInstalled) return false;
  const network = "tea-sepolia";
  const argsString = constructorArgs.map(arg => `"${arg}"`).join(" ");
  const cmd = `npx hardhat verify --network ${network} ${contractAddress} ${argsString}`;
  logInfo(`🔍 Verifying contract with Hardhat: ${cmd}`);
  let attempts = 0;
  while (attempts < maxAttempts) {
    logInfo(`🔍 Verification attempt: ${attempts + 1}/${maxAttempts}`);
    try {
      const { stdout } = await execPromise(cmd);
      const lowerOut = stdout.toLowerCase();
      if (lowerOut.includes("verification submitted") || lowerOut.includes("has already been verified") || lowerOut.includes("successfully verified contract")) {
        logSuccess(`🔍 Hardhat verification successful: ${stdout}`);
        return true;
      } else {
        logWarning(`🔍 Attempt ${attempts + 1} failed. Output: ${stdout}`);
      }
    } catch (error) {
      logError(`🔍 Attempt ${attempts + 1} failed: ${error}`);
    }
    attempts++;
    if (attempts < maxAttempts) {
      logInfo("🔍 Retrying contract verification in 5 seconds...");
      await delay(5000);
    }
  }
  logError(`🔍 Contract verification failed after ${maxAttempts} attempts. Please verify manually using Hardhat.`);
  return false;
}

async function mainMenu() {
  printBanner();
  try {
    const answer = await promptWithBack([
      { type: 'list', name: 'action', message: 'Choose an option (use arrow keys or numbers):', choices: [
          { name: '1. Deploy New Contract (Create ERC20 Token)', value: 'deploy' },
          { name: '2. Send Native (TEA) to address in verified_addresses.txt', value: 'sendNative' },
          { name: '3. Send ERC20 Token to address in verified_addresses.txt (if token deployed)', value: 'sendERC20' },
          { name: '4. Exit', value: 'exit' }
        ]
      }
    ]);
    if (answer === null) return mainMenu();
    if (answer.action === 'deploy') {
      await deployContract();
    } else if (answer.action === 'sendNative') {
      await sendNativeToken();
    } else if (answer.action === 'sendERC20') {
      await sendERC20Token();
    } else if (answer.action === 'exit') {
      console.clear();
      logInfo("🚪 Exiting safely...");
      process.exit(0);
    }
  } catch (error) {
    logError(`⚠️ Error in main menu: ${error}`);
  }
  mainMenu();
}

async function ensureHardhatInstalled() {
  if (!fs.existsSync("node_modules/hardhat/package.json")) {
    const answer = await promptWithBack([{ type: "confirm", name: "installHardhat", message: "🔧 Hardhat is not installed. Install now?", default: true }]);
    if (answer === null) return false;
    if (answer.installHardhat) {
      logInfo("🔧 Installing Hardhat and verification plugin...");
      try {
        await execPromise("npm install --save-dev hardhat @nomicfoundation/hardhat-verify");
        logSuccess("🔧 Hardhat and verification plugin installed successfully.");
      } catch (error) {
        logError("🔧 Failed to install Hardhat: " + error);
        process.exit(1);
      }
    } else {
      logWarning("⚠️ Hardhat not installed. Automatic verification will not run.");
      return false;
    }
  }
  if (!fs.existsSync("hardhat.config.cjs")) {
    const answer = await promptWithBack([{ type: "confirm", name: "initHardhat", message: "🚀 Hardhat project is not initialized. Initialize automatically?", default: true }]);
    if (answer === null) return false;
    if (answer.initHardhat) {
      logInfo("🚀 Initializing minimal Hardhat project...");
      await updateHardhatConfig();
    } else {
      logWarning("⚠️ Hardhat project not initialized. Automatic verification may fail.");
      return false;
    }
  }
  return true;
}

process.on("unhandledRejection", (reason, promise) => {
  console.error(`[${new Date().toLocaleTimeString()}]-[error] ❌ : Unhandled Rejection: ${reason}`);
});

mainMenu();
