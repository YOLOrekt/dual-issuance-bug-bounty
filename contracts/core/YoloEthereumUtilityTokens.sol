// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "../tokens-base/ERC20.sol";

/**
 * @dev {ERC20} token, including:
 *
 *  - Preminted initial supply
 *  - No access control mechanism (for minting/pausing) and hence no governance
 *  From OpenZep
 * _Available since v3.4._
 */
contract YoloEthereumUtilityTokens is ERC20 {
    /**
     * @dev Mints `initialSupply` amount of token and transfers them to `owner`.
     *
     * See {ERC20-constructor}.
     */
    constructor(
        string memory name,
        string memory symbol,
        address owner
    ) ERC20(name, symbol) {
        require(bytes(name).length != 0, "token name must be specified");
        require(bytes(symbol).length != 0, "token symbol must be specified");
        uint256 amount = 10**9 * 10**(decimals()); // 1 Billion Tokens
        _mint(owner, amount);
    }
}
