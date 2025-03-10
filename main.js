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

const MAIN_PRIVATE_KEY = process.env.MAIN_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || "https://dream-rpc.somnia.network";
const CHAIN_ID = process.env.CHAIN_ID || 50312;
let CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
const EXPLORER_URL = process.env.EXPLORER_URL || "";
const DAILY_LIMIT = 5000;

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(MAIN_PRIVATE_KEY, provider);

let contractInstance = null;

function getTimestamp() {
  return new Date().toLocaleTimeString();
}

function logInfo(message) {
  console.log(chalk.blue(`[${getTimestamp()}]-[info] ℹ️   : ${message}`));
}

function logSuccess(message) {
  console.log(chalk.green(`[${getTimestamp()}]-[success] ✓: ${message}`));
}

function logWarning(message) {
  console.log(chalk.yellow(`[${getTimestamp()}]-[warning] ⚠️: ${message}`));
}

function logError(message) {
  console.log(chalk.red(`[${getTimestamp()}]-[error] ✗: ${message}`));
}

async function promptWithBack(questions) {
  const answers = await inquirer.prompt(questions);
  for (const key in answers) {
    if (typeof answers[key] === 'string' && answers[key].trim().toLowerCase() === 'back') {
      logInfo("Input 'back' terdeteksi. Kembali ke menu utama...");
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

async function compileContractWithHardhat() {
  logInfo("Menjalankan Hardhat compile...");
  try {
    const { stdout } = await execPromise("npx hardhat compile");
    logSuccess("Hardhat compile berhasil.");
  } catch (error) {
    logError("Hardhat compile gagal: " + error);
    throw error;
  }
  const artifactPath = "artifacts/contracts/CustomToken.sol/CustomToken.json";
  if (!fs.existsSync(artifactPath)) {
    throw new Error("Artifact tidak ditemukan: " + artifactPath);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return { abi: artifact.abi, bytecode: artifact.bytecode.object || artifact.bytecode };
}

function getWalletData() {
  let wallets = [];
  if (fs.existsSync('random_wallets.json')) {
    const data = fs.readFileSync('random_wallets.json', 'utf8').trim();
    if (data !== "") {
      wallets = data.split(/\r?\n/).filter(line => line.trim() !== "").map(line => JSON.parse(line));
    }
  }
  return wallets;
}

function addWalletIfNotExists(walletObj) {
  let wallets = getWalletData();
  const exists = wallets.find(w => w.address.toLowerCase() === walletObj.address.toLowerCase());
  if (!exists) {
    fs.appendFileSync('random_wallets.json', JSON.stringify(walletObj) + "\n", { flag: 'a' });
  }
}

function createNewWallet() {
  const newWallet = ethers.Wallet.createRandom();
  return { address: newWallet.address, privateKey: newWallet.privateKey };
}

function createNewWallets(n) {
  const newWallets = [];
  for (let i = 0; i < n; i++) {
    let newWallet = createNewWallet();
    while (getWalletData().find(w => w.address.toLowerCase() === newWallet.address.toLowerCase())) {
      newWallet = createNewWallet();
    }
    addWalletIfNotExists(newWallet);
    newWallets.push(newWallet);
  }
  return newWallets;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

async function ensureHardhatInstalled() {
  if (!fs.existsSync("node_modules/hardhat/package.json")) {
    const answer = await promptWithBack([{
      type: "confirm",
      name: "installHardhat",
      message: "Hardhat belum diinstal. Apakah Anda ingin menginstalnya sekarang?",
      default: true
    }]);
    if (answer === null) return false;
    if (answer.installHardhat) {
      logInfo("Menginstal hardhat dan plugin verifikasi...");
      try {
        await execPromise("npm install --save-dev hardhat @nomicfoundation/hardhat-verify");
        logSuccess("Hardhat dan plugin verifikasi berhasil diinstal.");
      } catch (error) {
        logError("Gagal menginstal Hardhat: " + error);
        process.exit(1);
      }
    } else {
      logWarning("Hardhat tidak diinstal. Verifikasi otomatis tidak akan dijalankan.");
      return false;
    }
  }
  if (!fs.existsSync("hardhat.config.cjs")) {
    const answer = await promptWithBack([{
      type: "confirm",
      name: "initHardhat",
      message: "Hardhat project belum diinisialisasi. Apakah Anda ingin menginisialisasinya secara otomatis?",
      default: true
    }]);
    if (answer === null) return false;
    if (answer.initHardhat) {
      logInfo("Menginisialisasi Hardhat project minimal...");
      createMinimalHardhatConfig();
    } else {
      logWarning("Hardhat project tidak diinisialisasi. Verifikasi otomatis mungkin gagal.");
      return false;
    }
  }
  return true;
}

function createMinimalHardhatConfig() {
  const configContent = `require("@nomicfoundation/hardhat-verify");

module.exports = {
  solidity: "0.8.28",
  networks: {
    "somnia-testnet": {
      url: process.env.RPC_URL || "https://dream-rpc.somnia.network",
      chainId: 50312,
      accounts: [process.env.MAIN_PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: {
      "somnia-testnet": process.env.EXPLORER_API_KEY || "empty"
    },
    customChains: [
      {
        network: "somnia-testnet",
        chainId: 50312,
        urls: {
          apiURL: "https://shannon-explorer.somnia.network/api",
          browserURL: "https://shannon-explorer.somnia.network/"
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
  logInfo("Minimal hardhat.config.cjs telah dibuat.");
}

async function verifyContractHardhat(contractAddress, constructorArgs, maxAttempts = 3) {
  const isInstalled = await ensureHardhatInstalled();
  if (!isInstalled) return false;

  const network = "somnia-testnet";
  const argsString = constructorArgs.map(arg => `"${arg}"`).join(" ");
  const cmd = `npx hardhat verify --network ${network} ${contractAddress} ${argsString}`;
  logInfo(`Verifikasi kontrak dengan Hardhat: ${cmd}`);

  let attempts = 0;
  while (attempts < maxAttempts) {
    logInfo(`Percobaan verifikasi kontrak: ${attempts + 1}/${maxAttempts}`);
    try {
      const { stdout } = await execPromise(cmd);
      const lowerOut = stdout.toLowerCase();
      if (
        lowerOut.includes("verification submitted") ||
        lowerOut.includes("has already been verified") ||
        lowerOut.includes("successfully verified contract")
      ) {
        logSuccess(`Hardhat verification successful: ${stdout}`);
        return true;
      } else {
        logWarning(`Percobaan ${attempts + 1} gagal. Output: ${stdout}`);
      }
    } catch (error) {
      logError(`Percobaan ${attempts + 1} gagal: ${error}`);
    }
    attempts++;
    if (attempts < maxAttempts) {
      logInfo("Mencoba kembali verifikasi kontrak dalam 5 detik...");
      await delay(5000);
    }
  }
  logError(`Verifikasi kontrak gagal setelah ${maxAttempts} percobaan. Silakan verifikasi secara manual menggunakan Hardhat.`);
  return false;
}

async function deployContract() {
  const answers = await promptWithBack([
    { type: 'input', name: 'name', message: 'Masukkan Nama Kontrak:' },
    { type: 'input', name: 'symbol', message: ' Masukkan Simbol Kontrak:' },
    {
      type: 'input',
      name: 'decimals',
      message: 'Masukkan Desimal (default 18):',
      validate: input => {
        if (input.trim().toLowerCase() === 'back') return true;
        if (isNaN(input) || Number(input) <= 0) return 'Harus berupa angka yang valid';
        return true;
      }
    },
    {
      type: 'input',
      name: 'totalSupply',
      message: 'Masukkan Total Suplai (e.g 100000):',
      validate: input => {
        if (input.trim().toLowerCase() === 'back') return true;
        if (isNaN(input) || Number(input) <= 0) return 'Harus berupa angka yang valid';
        return true;
      }
    }
  ]);
  if (answers === null) return;

  printSeparator();
  logInfo("Mempersiapkan deploy kontrak...");

  const { abi, bytecode } = await compileContractWithHardhat();
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  const totalSupplyInWei = ethers.utils.parseUnits(answers.totalSupply, Number(answers.decimals));

  logInfo("Mengirim transaksi deployment kontrak...");
  const contract = await factory.deploy(answers.name, answers.symbol, Number(answers.decimals), totalSupplyInWei);
  logInfo(`Tx Hash: ${contract.deployTransaction.hash}`);
  if (EXPLORER_URL) {
    logInfo(`Lihat di explorer: ${EXPLORER_URL}/tx/${contract.deployTransaction.hash}`);
  }
  logInfo("Menunggu konfirmasi transaksi (ini bisa memakan waktu tergantung jaringan)...");
  await contract.deployed();
  logSuccess(`Kontrak berhasil dideploy di alamat: ${contract.address}`);
  printSeparator();

  contractInstance = contract;
  CONTRACT_ADDRESS = contract.address;
  updateEnvVariable("CONTRACT_ADDRESS", contract.address);

  logInfo("Melakukan verifikasi kontrak secara otomatis dengan Hardhat...");
  const verified = await verifyContractHardhat(contract.address, [answers.name, answers.symbol, answers.decimals, totalSupplyInWei.toString()]);
  if (!verified) {
    logWarning("Kontrak belum terverifikasi secara otomatis. Silakan verifikasi manual dengan Hardhat jika diperlukan.");
  } else {
    logSuccess("Verifikasi kontrak berhasil.");
  }

  logInfo(`Detail Kontrak:
  - Nama Kontrak   : ${answers.name}
  - Simbol Kontrak : ${answers.symbol}
  - Jumlah Desimal : ${answers.decimals}
  - Total Suplai   : ${answers.totalSupply} (setara dengan ${totalSupplyInWei.toString()} unit terkecil)
  - Alamat Kontrak : ${contract.address}
  - Status Verifikasi: ${verified ? "Terverifikasi" : "Belum Terverifikasi"}`);
  await inquirer.prompt([{ type: 'input', name: 'return', message: 'Tekan "Enter" untuk kembali ke menu utama...' }]);
}

async function sendNativeToken() {
  const answers = await promptWithBack([
    {
      type: 'input',
      name: 'jumlahTransaksi',
      message: 'Masukkan jumlah transaksi yang diinginkan (max 5k/day):',
      validate: input => {
        if (input.trim().toLowerCase() === 'back') return true;
        if (isNaN(input) || Number(input) <= 0) return 'Harus berupa angka yang valid';
        return true;
      }
    }
  ]);
  if (answers === null) return;
  const jumlahTransaksi = Number(answers.jumlahTransaksi);

  const counter = getDailyCounter();
  if (counter.count + jumlahTransaksi > DAILY_LIMIT) {
    logError(
      `Batas harian ${DAILY_LIMIT} transaksi telah tercapai atau tidak cukup sisa. Sisa transaksi hari ini: ${DAILY_LIMIT - counter.count}`
    );
    return;
  }

  printSeparator();
  logInfo(`Memulai pengiriman ${jumlahTransaksi} transaksi native token...\n`);

  let completed = 0;
  for (let i = 0; i < jumlahTransaksi; i++) {
    let newWallet = createNewWallet();
    while (getWalletData().find(w => w.address.toLowerCase() === newWallet.address.toLowerCase())) {
      newWallet = createNewWallet();
    }
    addWalletIfNotExists(newWallet);
    const recipient = newWallet.address;
    const randomAmount = (0.001 + Math.random() * (0.0025 - 0.001)).toFixed(6);
    const amount = ethers.utils.parseUnits(randomAmount, 18);

    logInfo(`Transaksi ${i + 1}: Mengirim ${randomAmount} STT ke ${recipient}...`);

    if (!CONTRACT_ADDRESS) {
      logWarning("Kontrak belum dideploy. Menggunakan wallet utama secara langsung.");
      try {
        const tx = await wallet.sendTransaction({ to: recipient, value: amount });
        logInfo(`Tx Hash: ${tx.hash}`);
        if (EXPLORER_URL) {
          logInfo(`Explorer: ${EXPLORER_URL}/tx/${tx.hash}`);
        }
        logInfo("Menunggu konfirmasi transaksi...");
        await tx.wait();
        logSuccess("Transfer berhasil.");
        completed++;
        const current = getDailyCounter();
        updateDailyCounter(current.count + 1);
      } catch (err) {
        logError(`Transfer gagal: ${err}`);
      }
    } else {
      if (!contractInstance) {
        const { abi } = await compileContractWithHardhat();
        contractInstance = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);
      }
      const contractBalance = await provider.getBalance(contractInstance.address);
      if (contractBalance.gte(amount)) {
        try {
          const tx = await contractInstance.sendNative(recipient, amount);
          logInfo(`Tx Hash: ${tx.hash}`);
          if (EXPLORER_URL) {
            logInfo(`Explorer: ${EXPLORER_URL}/tx/${tx.hash}`);
          }
          logInfo("Menunggu konfirmasi transaksi...");
          await tx.wait();
          logSuccess("Transfer berhasil melalui kontrak.");
          completed++;
          const current = getDailyCounter();
          updateDailyCounter(current.count + 1);
        } catch (err) {
          logError(`Transfer melalui kontrak gagal: ${err}`);
        }
      } else {
        logWarning("Kontrak tidak memiliki native token yang cukup. Menggunakan wallet utama sebagai pengirim.");
        try {
          const tx = await wallet.sendTransaction({ to: recipient, value: amount });
          logInfo(`Tx Hash: ${tx.hash}`);
          if (EXPLORER_URL) {
            logInfo(`Explorer: ${EXPLORER_URL}/tx/${tx.hash}`);
          }
          logInfo("Menunggu konfirmasi transaksi...");
          await tx.wait();
          logSuccess("Transfer berhasil.");
          completed++;
          const current = getDailyCounter();
          updateDailyCounter(current.count + 1);
        } catch (err) {
          logError(`Transfer gagal: ${err}`);
        }
      }
    }

    if (i < jumlahTransaksi - 1) {
      const randomDelay = Math.floor(Math.random() * (60000 - 15000 + 1)) + 15000;
      logInfo(`Menunggu ${(randomDelay / 1000).toFixed(2)} detik sebelum transaksi berikutnya...\n`);
      await delay(randomDelay);
      printSeparator();
    }
  }
  logSuccess(`Selesai mengirimkan ${completed} dari ${jumlahTransaksi} transaksi native token.`);
  await inquirer.prompt([{ type: 'input', name: 'return', message: 'Tekan "Enter" untuk kembali ke menu utama...' }]);
}

async function sendERC20Token() {
  if (!CONTRACT_ADDRESS) {
    logError("Kontrak belum dideploy. Silakan deploy kontrak terlebih dahulu.");
    await delay(5000);
    return;
  }
  if (!contractInstance) {
    const { abi } = await compileContractWithHardhat();
    contractInstance = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);
  }
  const answers = await promptWithBack([
    { type: 'input', name: 'tokenSymbol', message: 'Masukkan simbol token yang akan dikirim:' },
    {
      type: 'input',
      name: 'jumlahTransaksi',
      message: 'Masukkan jumlah transaksi yang diinginkan (max 5k/day):',
      validate: input => {
        if (input.trim().toLowerCase() === 'back') return true;
        if (isNaN(input) || Number(input) <= 0) return 'Harus berupa angka yang valid';
        return true;
      }
    },
    {
      type: 'input',
      name: 'amountPerTx',
      message: 'Masukkan jumlah token per transaksi (e.g 0.001):',
      validate: input => {
        if (input.trim().toLowerCase() === 'back') return true;
        if (isNaN(input) || Number(input) <= 0) return 'Harus berupa angka yang valid';
        return true;
      }
    }
  ]);
  if (answers === null) return;

  const deployedSymbol = await contractInstance.symbol();
  if (deployedSymbol !== answers.tokenSymbol) {
    logError(`Token dengan simbol ${answers.tokenSymbol} tidak ditemukan. Token yang dideploy adalah ${deployedSymbol}.`);
    await delay(5000);
    return;
  }

  const tokenDecimals = await contractInstance.decimals();
  const amountPerTxInSmallestUnit = ethers.utils.parseUnits(answers.amountPerTx, tokenDecimals);

  const counter = getDailyCounter();
  if (counter.count + Number(answers.jumlahTransaksi) > DAILY_LIMIT) {
    logError(
      `Batas harian ${DAILY_LIMIT} transaksi telah tercapai atau tidak cukup sisa. Sisa transaksi hari ini: ${DAILY_LIMIT - counter.count}`
    );
    return;
  }

  printSeparator();
  logInfo(`Memulai pengiriman ${answers.jumlahTransaksi} transaksi token ERC20...\n`);

  let completed = 0;
  const totalTx = Number(answers.jumlahTransaksi);
  for (let i = 0; i < totalTx; i++) {
    let newWallet = createNewWallet();
    while (getWalletData().find(w => w.address.toLowerCase() === newWallet.address.toLowerCase())) {
      newWallet = createNewWallet();
    }
    addWalletIfNotExists(newWallet);
    const recipient = newWallet.address;
    logInfo(`Transaksi ${i + 1}: Mengirim token ke ${recipient}...`);
    try {
      const tx = await contractInstance.sendToken(recipient, amountPerTxInSmallestUnit);
      logInfo(`Tx Hash: ${tx.hash}`);
      if (EXPLORER_URL) {
        logInfo(`Explorer: ${EXPLORER_URL}/tx/${tx.hash}`);
      }
      logInfo("Menunggu konfirmasi transaksi...");
      await tx.wait();
      logSuccess("Transfer berhasil.");
      completed++;
      const current = getDailyCounter();
      updateDailyCounter(current.count + 1);
    } catch (err) {
      logError(`Transfer gagal: ${err}`);
    }
    if (i < totalTx - 1) {
      const randomDelay = Math.floor(Math.random() * (80000 - 10000 + 1)) + 10000;
      logInfo(`Menunggu ${(randomDelay / 1000).toFixed(2)} detik sebelum transaksi berikutnya...\n`);
      await delay(randomDelay);
      printSeparator();
    }
  }
  logSuccess(`Selesai mengirimkan ${completed} dari ${answers.jumlahTransaksi} transaksi token ERC20.`);
  await inquirer.prompt([{ type: 'input', name: 'return', message: 'Tekan "Enter" untuk kembali ke menu utama...' }]);
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
  logInfo(`File .env diperbarui: ${key}=${value}`);
}

async function mainMenu() {
  printBanner();
  const answer = await promptWithBack([
    {
      type: 'list',
      name: 'action',
      message: 'Pilih opsi (gunakan angka atau tombol panah):',
      choices: [
        { name: '1. Deploy Kontrak Baru (Create ERC20 Token)', value: 'deploy' },
        { name: '2. Kirim Native (STT) Ke Alamat Random (Random value 0.001-0.0025) ', value: 'sendNative' },
        { name: '3. Kirim Token ERC20 ke alamat Random (jika sudah deploy custom token)', value: 'sendERC20' },
        { name: '4. Keluar', value: 'exit' }
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
    logInfo("Keluar dengan aman...");
    process.exit(0);
  }
  mainMenu();
}

mainMenu();
