# Tea-Testnet-deployer

 **Automated Token Deployment and Distribution Tool**

- A CLI tool for deploying ERC20 token contracts and distributing tokens/native assets on the Tea Sepolia Testnet.

## Key Features
- 🛠️ Deploy custom ERC20 contracts with automatic verification
- 💸 Distribute native tokens (TEA) to verified addresses
- 🪙 Distribute ERC20 tokens to verified addresses
- 🔒 Automatic wallet management with daily transaction limits
- ⏳ Realistic transaction pattern simulation with random delays
- 🔍 Integrated with Tea Sepolia blockchain explorer

## Prerequisites
- Node.js v18+
- npm v9+
- Hardhat (will be installed automatically if not present)
- Blockchain account with TEA balance

## Installation
1. Clone repository:
```bash
git clone https://github.com/Endijuan33/Tea-Testnet-Deployer.git
cd Tea-Testnet-Deployer
```

2. Install dependencies:
```bash
npm install
```

3. Copy .env.example to .env and configure required settings:
```bash
MAIN_PRIVATE_KEY=0xyour_wallet_private_key
RPC_URL=https://tea-sepolia.g.alchemy.com/public
CHAIN_ID=10218
EXPLORER_URL=https://sepolia.tea.xyz/
CONTRACT_ADDRESS=
```

## Configuration
| Variable            | Description                                      | Example Value                         |
|---------------------|--------------------------------------------------|---------------------------------------|
| MAIN_PRIVATE_KEY    | Main wallet's private key                        | 0xabc123...                           |
| RPC_URL             | Tea network RPC URL                              | https://tea-sepolia.g.alchemy.com/public |
| CHAIN_ID            | Tea Testnet chain ID                             | 10218                                 |
| CONTRACT_ADDRESS    | Contract address (auto-filled after deployment)  | 0x...                                 |
| EXPLORER_URL        | Blockchain explorer URL                          | https://sepolia.tea.xyz/              |

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

2. **Send Native Token (TEA)**
   - Distribute TEA to verified addresses
   - Daily limit: 5,000 transactions/day or based on addresses.txt files
   - Random delay between 10-60 seconds between transactions

3. **Send ERC20 Tokens**
   - Distribute tokens to verified addresses
   - Input tokens amount per transaction
   - Uses deployed contract
   - Same daily limits as native token distribution

## Security
- 🚫 Never share `.env` files
- 🔐 Private keys stored only in local environment variables
- ⚠️ Use responsibly and comply with network rules - DYOR!

## Important Notes
- Ensure main wallet has sufficient TEA balance
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
cd Tea-Testnet-Deployer

# Fetch and merge latest changes from repository
git pull origin main

# Reinstall dependencies if there are package changes
npm install
```


## License
[MIT](https://github.com/Endijuan33/Tea-Testnet-deployer/blob/main/LICENSE) License

## Disclaimer
⚠️ **Educational Use Only** 
- This script is provided **exclusively for educational and testing purposes** on the Tea Testnet
- All transactions use **testnet assets** with no real monetary value
- Not affiliated with or endorsed by Tea or any blockchain entity
- NO WARRANTIES expressed or implied - use at your own risk
- Developers assume no liability for:
  - Any financial losses
  - Account bans
  - Network disruptions
  - Legal consequences of misuse
- Mainnet use is **strictly discouraged** and may violate network policies
- Users are solely responsible for complying with local regulations


