/**

For unit testing - overwriting FxBaseChildTunnel external functions

**/

pragma solidity 0.8.4;

import {IERC20} from "../tokens-base/IERC20.sol";
import {YoloPolygonUtilityTokens} from "../core/YoloPolygonUtilityTokens.sol";
// import {Mock_FxBaseChildTunnel} from "../mock-fx/Mock_FxBaseChildTunnel.sol";
import {IssuancePolygon} from "../issuance/IssuancePolygon.sol";
import {Mock_IssuanceEthereum} from "./Mock_IssuanceEthereum.sol";

contract Mock_IssuancePolygon is IssuancePolygon {
    Mock_IssuanceEthereum mockIssuanceEthereumContract;

    constructor(
        address yoloPolygonTokenAddress_,
        address mEthTokenContract_,
        address fxChild_
    ) IssuancePolygon(yoloPolygonTokenAddress_, mEthTokenContract_, fxChild_) {}

    function setMockIssuanceEthereumContract(
        address _mockIssuanceEthereumContract
    ) external restricted returns (bool) {
        mockIssuanceEthereumContract = Mock_IssuanceEthereum(
            _mockIssuanceEthereumContract
        );

        return true;
    }

    function redeemTokens() external override returns (bool) {
        // Which will unlock once the product goes live.
        require(
            isRedemptionRegimeOpen == true,
            "redemption window is not open yet"
        );
        require(claimsCheck[msg.sender] == false, "prior claim executed");
        claimsCheck[msg.sender] = true;

        uint256 claimAmount = (contributorAmounts[msg.sender] *
            childIssuanceAllocatedTokens) / childSum;

        yoloPolygonTokenContract.transfer(msg.sender, claimAmount);

        // TODO: Set it zero? Replace claimsCheck bools? Any reasons we should or shoudn't set it zero.
        contributorAmounts[msg.sender] = 0;

        emit TokensRedeemed(msg.sender, claimAmount);

        return true;
    }
}
