# Somnia-Testnet-deployer

 **Automated Token Deployment and Distribution Tool**

- A CLI tool for deploying ERC20 token contracts and distributing tokens/native assets on the Somnia Testnet.

## Key Features
- 🛠️ Deploy custom ERC20 contracts with automatic verification
- 💸 Distribute native tokens (STT) to random addresses with random values
- 🪙 Distribute ERC20 tokens to random addresses
- 🔒 Automatic wallet management with daily transaction limits
- ⏳ Realistic transaction pattern simulation with random delays
- 🔍 Integrated with Somnia blockchain explorer

## Prerequisites
- Node.js v18+
- npm v9+
- Hardhat (will be installed automatically if not present)
- Blockchain account with STT balance

## Installation
1. Clone repository:
```bash
git clone https://github.com/Endijuan33/Somnia-Testnet-deployer.git
cd Somnia-Testnet-deployer
```

2. Install dependencies:
```bash
npm install
```

3. Copy .env.example to .env and configure required settings:
```bash
MAIN_PRIVATE_KEY=0xyour_wallet_private_key
RPC_URL=https://dream-rpc.somnia.network,https://rpc.ankr.com/somnia_testnet,https://somnia-poc.w3us.site/api/eth-rpc
CHAIN_ID=50312
EXPLORER_URL=https://shannon-explorer.somnia.network/
CONTRACT_ADDRESS=
```

## Configuration
| Variable            | Description                                      | Example Value                         |
|---------------------|--------------------------------------------------|---------------------------------------|
| MAIN_PRIVATE_KEY    | Main wallet's private key                        | 0xabc123...                           |
| RPC_URL             | Somnia network RPC URL                           | https://dream-rpc.somnia.network      |
| CHAIN_ID            | Somnia Testnet chain ID                          | 50312                                 |
| CONTRACT_ADDRESS    | Contract address (auto-filled after deployment)  | 0x...                                 |
| EXPLORER_URL        | Blockchain explorer URL                          | https://shannon-explorer.somnia.network |

## Usage
Run command:
```bash
npm run start
```
Follow the interactive menu instructions in the CLI. For first-time use, we recommend deploying a contract before distributing tokens.

Observe daily transaction limits and ensure the main wallet has sufficient balance for gas fees and token distribution.

### Main Menu
1. **Deploy New Contract**
   - Create custom ERC20 token
   - Guided input for:
     - Token Name
     - Token Symbol
     - Decimal Places
     - Total Supply
   - Automatic contract verification after deployment

2. **Send Native Token (STT)**
   - Distribute STT to random addresses
   - Random value: 0.001-0.0025 STT per transaction
   - Daily limit: 5,000 transactions/day
   - Random delay between 15-60 seconds between transactions

3. **Send ERC20 Tokens**
   - Distribute tokens to random addresses
   - Input tokens amount per transaction
   - Uses deployed contract
   - Same daily limits as native token distribution

## Security
- 🚫 Never share `.env` or `random_wallets.json` files
- 🔐 Private keys stored only in local environment variables
- ⚠️ Use responsibly and comply with network rules - DYOR!

## Important Notes
- Ensure main wallet has sufficient STT balance
- Contract verification requires Hardhat - will be auto-installed
- Failed transactions will be reported without stopping the process

To run the script:

1. Ensure all dependencies are installed
2. Configure `.env` file properly
3. Run command:
```bash
npm start
```

## Updating the Script
To get the latest version of the script and ensure you have all updates:
```bash
# Navigate to your project directory if you're not already there
cd Somnia-Testnet-deployer

# Fetch and merge latest changes from repository
git pull origin main

# Reinstall dependencies if there are package changes
npm install
```


## License
[MIT](https://github.com/Endijuan33/Somnia-Testnet-deployer/blob/main/LICENSE) License

## Disclaimer
⚠️ **Educational Use Only** 
- This script is provided **exclusively for educational and testing purposes** on the Somnia Testnet
- All transactions use **testnet assets** with no real monetary value
- Not affiliated with or endorsed by Somnia or any blockchain entity
- NO WARRANTIES expressed or implied - use at your own risk
- Developers assume no liability for:
  - Any financial losses
  - Account bans
  - Network disruptions
  - Legal consequences of misuse
- Mainnet use is **strictly discouraged** and may violate network policies
- Users are solely responsible for complying with local regulations


