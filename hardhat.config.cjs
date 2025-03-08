require("@nomicfoundation/hardhat-verify");

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
