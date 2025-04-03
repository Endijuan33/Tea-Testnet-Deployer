// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CustomToken is ERC20 {
    uint8 private _customDecimals;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_
    ) ERC20(name_, symbol_) {
        owner = msg.sender;
        _customDecimals = decimals_;
        // Mint token ke alamat deployer
        _mint(msg.sender, totalSupply_);
    }

    function decimals() public view virtual override returns (uint8) {
        return _customDecimals;
    }

    function sendNative(address payable recipient, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Contract's native balance is insufficient");
        (bool sent, ) = recipient.call{value: amount}("");
        require(sent, "Native token transfer failed");
    }

    function sendToken(address recipient, uint256 amount) external onlyOwner {
        _transfer(msg.sender, recipient, amount);
    }

    receive() external payable {}
}
