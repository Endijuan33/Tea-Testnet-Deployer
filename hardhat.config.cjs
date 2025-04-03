require("@nomicfoundation/hardhat-verify");

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
