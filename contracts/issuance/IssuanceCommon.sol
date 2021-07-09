pragma solidity 0.8.4;

import "../access/Ownable.sol";

abstract contract IssuanceCommon is Ownable {
    uint256 public immutable deploymentTimestamp;

    address public fundRecipient;
    bool public isContributionWindowOpen;
    bool public isContributionWindowClosed;
    bool public isRedemptionRegimeOpen;
    uint256 public contributionStartTimestamp;

    // !!! mark internal for unit testing
    // Mapping contributors address to amount
    mapping(address => uint256) public contributorAmounts;

    // should claim data be easily available?
    mapping(address => bool) public claimsCheck;

    event ContributionWindowOpened(address indexed authorizer);
    event ContributionMade(address indexed contributor, uint256 value);
    event ContributionWindowClosed(address indexed authorizer, uint256 value);
    event RedemptionWindowOpened(
        address indexed authorizer,
        uint256 contributionValue,
        uint256 allocatedTokens
    );
    event TokensRedeemed(address indexed redeemer, uint256 value);
    event InvestmentFundTransferred(address indexed recipient, uint256 value);

    modifier validateRecipient(address _recipient) {
        require(_recipient != address(0), "recipient cannot be zero address");
        require(
            _recipient == fundRecipient,
            "recipient must match registered fund receiver!"
        );
        _;
    }

    constructor() {
        deploymentTimestamp = block.timestamp;
    }

    function openContributionWindow() external virtual returns (bool);

    function closeContributionWindow() external virtual returns (bool);

    function openRedemptionRegime() external virtual returns (bool);

    function registerFundRecipient(address _fundRecipient)
        external
        restricted
        returns (bool)
    {
        fundRecipient = _fundRecipient;

        return true;
    }

    function redeemTokens() external virtual returns (bool);
}
