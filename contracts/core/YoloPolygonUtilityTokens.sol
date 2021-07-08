// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {ERC20} from "../tokens-base/ERC20.sol";

// import {NativeMetaTransaction} from "../utils/NativeMetaTransaction.sol";
// import {ContextMixin} from "../utils/ContextMixin.sol";

/**
 * @dev {YoloPolygonUtilityTokens} token, including:
 *
 *  - No initial supply
 *  - Controlled by
 *  - No access control mechanism (for minting/pausing) and hence no governance
 *
 */
contract YoloPolygonUtilityTokens is ERC20 {
    /**
     * @dev Mints `initialSupply` amount of token and transfers them to `owner`.
     *
     * See {ERC20-constructor}.
     */

    // set childChainManagerProxy to RootChainManager for unit testing
    address public childChainManagerProxy;
    address deployer;

    constructor(
        string memory name,
        string memory symbol,
        address _childChainManagerProxy
    ) ERC20(name, symbol) {
        childChainManagerProxy = _childChainManagerProxy; // 0xb5505a6d998549090530911180f38aC5130101c6
        deployer = msg.sender;
    }

    // being proxified smart contract, most probably childChainManagerProxy contract's address
    // is not going to change ever, but still, lets keep it
    function updateChildChainManager(address newChildChainManagerProxy)
        external
    {
        require(
            newChildChainManagerProxy != address(0),
            "Bad ChildChainManagerProxy address"
        );
        require(msg.sender == deployer, "You're not allowed");

        childChainManagerProxy = newChildChainManagerProxy;
    }

    function deposit(address user, bytes calldata depositData) external {
        require(
            msg.sender == childChainManagerProxy,
            "You're not allowed to deposit"
        );

        uint256 amount = abi.decode(depositData, (uint256));

        // `amount` token getting minted here & equal amount got locked in RootChainManager
        _totalSupply += amount;
        _balances[user] += (amount);

        emit Transfer(address(0), user, amount);
    }

    function withdraw(uint256 amount) external {
        _balances[msg.sender] -= amount;
        _totalSupply -= amount;

        emit Transfer(msg.sender, address(0), amount);
    }
}
