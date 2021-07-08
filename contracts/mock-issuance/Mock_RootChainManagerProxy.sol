pragma solidity 0.8.4;

import "../core/YoloEthereumUtilityTokens.sol";
import "./Mock_ChildChainManagerProxy.sol";

contract Mock_RootChainManagerProxy {
    address rootIssuanceAddress;
    YoloEthereumUtilityTokens yoloEthereumTokensContract;
    Mock_ChildChainManagerProxy childChainManagerProxyContract;

    constructor(address childChainManagerAddress_) {
        childChainManagerProxyContract = Mock_ChildChainManagerProxy(
            childChainManagerAddress_
        );
    }

    function setRootIssuanceAddress(address _rootIssuanceAddress)
        public
        returns (bool)
    {
        rootIssuanceAddress = _rootIssuanceAddress;

        return true;
    }

    // mock logic here
    function depositFor(
        address receiver,
        address rootTokenContractAddress,
        bytes memory encodedAmount
    ) public returns (bool) {
        uint256 decodedAmount = abi.decode(encodedAmount, (uint256));

        yoloEthereumTokensContract = YoloEthereumUtilityTokens(
            rootTokenContractAddress
        );

        yoloEthereumTokensContract.transferFrom(
            rootIssuanceAddress,
            address(1), // pick random dump address
            decodedAmount
        );

        childChainManagerProxyContract.depositToChild(receiver, decodedAmount);

        return true;
    }
}
