// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

/**
 * @dev Interface of the YOLO core contract.
 */
interface IYoloCore {
    // TODO: determine if we want to use mapping of symbol to uint instead
    struct Balances {
        uint256 ethBalance;
        uint256 yoloBalance;
    }

    struct LpDeposit {
        address[] addresses;
        uint256[] newDeposits;
    }

    struct LpRemoval {
        address[] addresses;
        uint256[] burnAmounts;
    }

    struct LpData {
        address[] addresses;
        Balances[] balances;
    }

    struct DepositData {
        address[] addresses;
        Balances[] depositAmounts;
    }

    struct WithdrawData {
        address[] addresses;
        Balances[] withdrawAmounts;
    }

    // TODO: determine if we're using onchain user balances in first iteration
    struct UserData {
        address[] addresses;
        Balances[] balances;
    }

    /**
     * @dev Emitted when `msg.sender` makes a request to add liquidity.
     */
    event AddLiquidityRequest(address indexed sender, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event RemoveLiquidityRequest(address indexed receiver, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event RemoveLiquidityRequestTo(
        address indexed authorizer,
        address indexed receiver,
        uint256 value
    );

    /**
     * @dev Emitted when this lockContract balance is
     * tranferred to Polygon mirror contract for L2 minting.
     */
    event MirrorTransfer(
        address indexed owner,
        address indexed mirror,
        uint256 value
    );

    /**
     * @dev Emitted when a user deposits amount with ETH or YOLO to participate in prediction games.
     * a call to {approve}. `value` is the new allowance.
     */
    event UserBalanceDeposit(
        address indexed owner,
        uint256 tokenAmount,
        uint256 ethAmount
    );

    /**
     * @dev Emitted when a user requests amount ETH or YOLO to withdraw from their account.
     */
    event UserBalanceWithdrawRequest(
        address indexed owner,
        uint256 tokenAmount,
        uint256 ethAmount
    );

    /**
     * @dev Emitted when admin updates user ETH and YOLO balance onchain.
     */
    event UserUpdate(
        address indexed sender,
        uint256 indexed ethValue,
        uint256 indexed yoloValue
    );

    /**
     * @dev Emitted when a user withdrawal request for ETH or YOLO is processed.
     */
    event UserWithdrawal(
        address indexed withdrawer,
        uint256 indexed ethValue,
        uint256 indexed yoloValue
    );

    function requestAddLiquidity(uint256 amount) external returns (bool);

    function requestRemoveLiquidity(uint256 shareAmount)
        external
        returns (bool);

    function depositUserBalance(uint256 tokenAmount)
        external
        payable
        returns (bool);

    function withdrawRequestUserBalance(uint256 tokenAmount, uint256 ethAmount)
        external
        returns (bool);

    function mintInitialShares(uint256 initialLiquidityProvisionAmount)
        external
        returns (bool);

    function updateLpBalances(
        Balances calldata poolUpdate,
        LpDeposit calldata newLpData,
        LpRemoval calldata removeLpData
    ) external payable returns (bool);

    function updateUserBalances(UserData calldata userUpdates)
        external
        payable
        returns (bool);

    function processUserWithdrawRequests(WithdrawData calldata withdrawData)
        external
        payable
        returns (bool);

    // TODO: implement
    /**
     * @dev Returns player amount of tokens owned by `account`.
     * @param account The LP account address.
     * @return The account balance in yolo core pool balance.
     */
    // function balanceOf(address account) external returns (uint256);

    /**
     * @dev Calculates pool tokens that can be claimed by LP account at moment of call. The result will be inaccurate until L2 implementation and migration has occurred. Use the provider dashboard (off-chain API call) to get a current account of token share.
     * @param account The LP account address.
     * @return The share of pool tokens owned by LP balance in yolo core pool balance.
     */
    // function calculatePoolTokenShare(address account)
    //     external
    //     view
    //     returns (uint256);

    /**
     * @dev Allows LP to delegate withdrawable amount based on same logic as
     * requestLiquidityRemoval method
     * @param recipient Account delegated to receive the withdrawal on behalf of LP.
     * @param shareAmount Share amount of pool to be withdrawn.
     * @return Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    // function requestLiquidityRemovalTo(address recipient, uint256 shareAmount)
    //     external
    //     returns (bool);
}
