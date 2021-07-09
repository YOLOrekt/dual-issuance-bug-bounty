/**

YOLOrekt Token Issuance - 

YOLOrekt is issuing 5% of the 1 Billion total supply to raise capital to provide in-game liquidity. 
This contracts accepts ETH contributions for acquiring early YOLO tokens at a price that 
is determined at close by calculating proportion of funds raised on the ethereum root chain 
with respect to the polygon child chain and sending the appropriate share of YOLO tokens to the 
child issuance contract, while encumbering the appropriate amount (the remainder) for 
redemption by the contributors within the Ethereum (root) chain.

https://yolorekt.com 

Authors :
Garen Vartanian
Yogesh Srihari 

**/

pragma solidity 0.8.4;

import "../core/YoloEthereumUtilityTokens.sol";
import {IRootChainManager} from "../fx-portal/IRootChainManager.sol";
import {FxBaseRootTunnel} from "../fx-portal/tunnel/FxBaseRootTunnel.sol";
import {IssuanceCommon} from "./IssuanceCommon.sol";

contract IssuanceEthereum is IssuanceCommon, FxBaseRootTunnel {
    uint256 public constant TOTAL_ISSUANCE_CONTRACT_TOKENS =
        50 * 10**6 * 10**18; // 5% of 1B tokens

    // YOLOrekt's ERC20 Contracts
    YoloEthereumUtilityTokens public immutable yoloEthereumTokenContract;

    // Sum of contribution on Ethereum side
    uint256 public rootSum;

    // Remaining proportion after distribution Polygon side's contribution
    uint256 public rootIssuanceAllocatedTokens;

    // Polygon's Total Contribution Sum in Wei (mEth)
    uint256 public childSum;

    // Polygon sum received from child tunnel and processed
    bool public hasProcessedMessageFromChild;

    // Polygon side token proportion requested to be sent
    bool public hasRootToChildTransferRequest;

    // Predicate contract for ERC20 token lock and transfer across root to child
    address public predicateContractAddress;

    // Polygon root contracts watched by Heimdall nodes
    IRootChainManager public rootChainManagerContract;

    constructor(
        address yoloEthereumTokenAddress_,
        address checkpointManager_,
        address fxRoot_,
        address fxChildTunnel_,
        address rootChainManager_,
        address predicateContractAddress_
    ) FxBaseRootTunnel(checkpointManager_, fxRoot_, fxChildTunnel_) {
        require(
            yoloEthereumTokenAddress_ != address(0),
            "YOLO ethereum token contract address must be specified"
        );
        require(
            checkpointManager_ != address(0),
            "checkpointManager contract address must be specified"
        );
        require(
            fxRoot_ != address(0),
            "fxRoot contract address must be specified"
        );
        require(
            fxChildTunnel_ != address(0),
            "fx child tunnel aka child issuance contract address must be specified"
        );
        require(
            rootChainManager_ != address(0),
            "root chain manager contract address must be specified"
        );
        require(
            predicateContractAddress_ != address(0),
            "erc20 predicate contract address must be specified"
        );

        // TODO: Use ChainId to compare and stop contract instantiaion if its the wrong address?

        yoloEthereumTokenContract = YoloEthereumUtilityTokens(
            yoloEthereumTokenAddress_
        );
        rootChainManagerContract = IRootChainManager(rootChainManager_);
        predicateContractAddress = predicateContractAddress_;
    }

    // just in case
    function setPredicateContractAddress(address contractAddress)
        external
        restricted
        returns (bool)
    {
        predicateContractAddress = contractAddress;

        return true;
    }

    // just in case
    function setRootManagerContract(address contractAddress)
        external
        restricted
        returns (bool)
    {
        rootChainManagerContract = IRootChainManager(contractAddress);

        return true;
    }

    // escape hatch - for unlikely scenario where incorrect amount of tokens transferred into
    // issaunce contract, e.g. value other than TOTAL_ISSUANCE_CONTRACT_TOKENS (50 Million)
    // transferred into IssuanceEthereum
    function returnYoloTokens(address ownerAddress, uint256 amount)
        external
        restricted
        returns (bool)
    {
        require(
            isContributionWindowOpen == false,
            "contribution window already opened"
        );

        yoloEthereumTokenContract.transfer(ownerAddress, amount);

        return true;
    }

    function openContributionWindow()
        external
        override
        restricted
        returns (bool)
    {
        require(
            yoloEthereumTokenContract.balanceOf(address(this)) ==
                TOTAL_ISSUANCE_CONTRACT_TOKENS,
            "50 million tokens must be transferred to issuance contract before issuance is started"
        );
        require(
            isContributionWindowOpen == false,
            "contribution window already opened"
        );

        isContributionWindowOpen = true;
        contributionStartTimestamp = block.timestamp;
        emit ContributionWindowOpened(msg.sender);

        return true;
    }

    function contribute() public payable returns (bool) {
        require(
            isContributionWindowOpen == true,
            "contribution window has not opened"
        );
        require(
            isContributionWindowClosed == false,
            "contribution window has closed"
        );
        require(msg.value > 0, "zero amount invalid");

        uint256 contributorTotal = contributorAmounts[msg.sender] + msg.value;

        contributorAmounts[msg.sender] = contributorTotal;
        rootSum += msg.value;
        emit ContributionMade(msg.sender, msg.value);

        return true;
    }

    function closeContributionWindow()
        external
        override
        restricted
        returns (bool)
    {
        require(
            isContributionWindowOpen == true,
            "contribution window must be open before closing"
        );

        isContributionWindowClosed = true;

        emit ContributionWindowClosed(msg.sender, rootSum);

        return true;
    }

    function _processMessageFromChild(bytes memory data) internal override {
        childSum = abi.decode(data, (uint256));
        hasProcessedMessageFromChild = true;
    }

    // !!! remove virtual after testing
    function depositOnChildIssuanceContract()
        external
        virtual
        restricted
        returns (bool)
    {
        require(
            hasProcessedMessageFromChild == true,
            "childSum must be processed from child first"
        );

        require(
            isContributionWindowClosed == true,
            "contribution window must be closed"
        );
        require(
            predicateContractAddress != address(0),
            "predicate contract address must be set"
        );

        // expressions can overflow, assign sum first
        uint256 totalCrossChainSum = rootSum + childSum;
        uint256 childTokenAmount = (TOTAL_ISSUANCE_CONTRACT_TOKENS * childSum) /
            totalCrossChainSum;

        rootIssuanceAllocatedTokens =
            TOTAL_ISSUANCE_CONTRACT_TOKENS -
            childTokenAmount;

        yoloEthereumTokenContract.approve(
            predicateContractAddress,
            childTokenAmount
        );

        bytes memory encodedChildAmount = abi.encode(childTokenAmount);

        rootChainManagerContract.depositFor(
            fxChildTunnel,
            address(yoloEthereumTokenContract),
            encodedChildAmount
        );

        hasRootToChildTransferRequest = true;

        return true;
    }

    function openRedemptionRegime() external override returns (bool) {
        // TODO: Zero Contribution case
        // check repeateadly - this means isContributionWindowClosed is also true
        require(
            hasRootToChildTransferRequest == true,
            "requires token transfer request to child and updated root token pool amount"
        );

        require(
            msg.sender == owner ||
                block.timestamp > contributionStartTimestamp + 60 days,
            "cannot open redemption window unless owner or 60 days since deployment"
        );
        require(
            isRedemptionRegimeOpen == false,
            "redemption regime already open"
        );

        isRedemptionRegimeOpen = true;

        emit RedemptionWindowOpened(
            msg.sender,
            rootSum,
            rootIssuanceAllocatedTokens
        );

        return true;
    }

    function migrateInvestmentFund(address payable recipient)
        external
        restricted
        validateRecipient(recipient)
        returns (bool)
    {
        require(
            isContributionWindowClosed == true,
            "contribution window must be closed"
        );

        uint256 contractBalance = address(this).balance;
        recipient.transfer(contractBalance);
        emit InvestmentFundTransferred(recipient, contractBalance);

        return true;
    }

    // TODO: either allow them to withdraw or use "make love not war" pattern
    function redeemTokens() external override returns (bool) {
        // Which will unlock once the product goes live.
        require(
            isRedemptionRegimeOpen == true,
            "redemption window is not open yet"
        );
        require(claimsCheck[msg.sender] == false, "prior claim executed");
        // TODO: should we replace with zeroing contrib amount?
        claimsCheck[msg.sender] = true;

        uint256 claimAmount = (contributorAmounts[msg.sender] *
            rootIssuanceAllocatedTokens) / rootSum;

        yoloEthereumTokenContract.transfer(msg.sender, claimAmount);
        emit TokensRedeemed(msg.sender, claimAmount);

        return true;
    }
}
