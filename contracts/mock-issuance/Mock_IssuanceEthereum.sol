/**

For unit testing - overwriting FxBaseRootTunnel external calls and POS token tfr call

**/

pragma solidity ^0.8.0;

import "../core/YoloEthereumUtilityTokens.sol";
import {IRootChainManager} from "../fx-portal/IRootChainManager.sol";
// import {Mock_FxBaseRootTunnel} from "../mock-fx/Mock_FxBaseRootTunnel.sol";
import {IssuanceCommon} from "../issuance/IssuanceCommon.sol";
import {IssuanceEthereum} from "../issuance/IssuanceEthereum.sol";

// TODO: add FxBaseRootTunnel contract deployed by matic to read to and from matic chain

contract Mock_IssuanceEthereum is IssuanceEthereum {
    constructor(
        address yoloEthereumTokenAddress_,
        address checkpointManager_,
        address fxRoot_,
        address fxChildTunnel_,
        address rootChainManager_,
        address predicateContractAddress_
    )
        IssuanceEthereum(
            yoloEthereumTokenAddress_,
            checkpointManager_,
            fxRoot_,
            fxChildTunnel_,
            rootChainManager_,
            predicateContractAddress_
        )
    {}

    function receiveMessage(bytes memory inputData) public override {
        // critical validation takes place here, mock input directly
        bytes memory message = inputData;
        _processMessageFromChild(message);
    }

    // for reference
    // function _processMessageFromChild(bytes memory data)
    //     internal
    //     override
    // {
    //     childSum = abi.decode(data, (uint256));
    //     hasProcessedMessageFromChild = true;
    // }
}
