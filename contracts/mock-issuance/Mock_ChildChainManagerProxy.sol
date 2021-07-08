pragma solidity 0.8.4;

import "../core/YoloPolygonUtilityTokens.sol";

contract Mock_ChildChainManagerProxy {
    YoloPolygonUtilityTokens yoloPolygonTokensContract;

    function setPolygonTokenAddress(address _polygonTokenAddress) public {
        yoloPolygonTokensContract = YoloPolygonUtilityTokens(
            _polygonTokenAddress
        );
    }

    function depositToChild(address childIssuanceAddress, uint256 amount)
        public
    {
        bytes memory encodedAmount = abi.encode(amount);

        yoloPolygonTokensContract.deposit(childIssuanceAddress, encodedAmount);
    }
}
