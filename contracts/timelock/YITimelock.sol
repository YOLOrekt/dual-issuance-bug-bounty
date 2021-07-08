pragma solidity ^0.8.0;

import "../utils/ECDSA.sol";
import "../tokens-base/SafeERC20.sol";
import "../core/IYoloCore.sol";
import "./TimelockBase.sol";

/**
 * @dev A token holder contract that will allow a beneficiary to extract the
 * tokens after a given release time.
 *
 * Useful for simple vesting schedules like "advisors get all of their tokens
 * after 1 year".
 */
contract TokenTimelock is TokenTimelockBase {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // change to YoloRegistryAddress and grab current core address from there
    IYoloCore yoloCoreAddress;
    address public owner;

    constructor(
        IERC20 token_,
        address beneficiary_,
        uint256 releaseTime_,
        IYoloCore yoloCoreAddress_,
        bytes memory signature_
    ) TokenTimelockBase(token_, beneficiary_, releaseTime_) {
        // This recreates the message hash that was signed by the beneficiary.
        // CANNOT be arbitrary message
        // Tell investors to sign: "YOLO EOA OK"
        // client should hash and sign this -> abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        bytes32 hash = keccak256(abi.encodePacked(bytes32("YOLO EOA OK")));
        bytes32 messageHash = hash.toEthSignedMessageHash();

        // Verify that the signer is the owner
        address signer = messageHash.recover(signature_);
        require(signer == beneficiary_, "signer is not beneficiary");

        owner = msg.sender;
        yoloCoreAddress = yoloCoreAddress_;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only Owner");
        _;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyBeneficiary() {
        require(msg.sender == beneficiary, "Only Beneficiary");
        _;
    }

    // in case investor has lost EOA
    function changeBeneficiary(address newBeneficiary)
        external
        onlyOwner
        returns (bool)
    {
        require(
            block.timestamp >= releaseTime() + 14 days,
            "TokenTimelock: current time is before release time"
        );
        beneficiary = newBeneficiary;

        return true;
    }

    // change this to approve call on yolo ERC20 - see sequence diagram
    function addRequest(uint256 amount)
        external
        onlyBeneficiary
        returns (bool)
    {
        // TODO: address coreAddress = IYoloRegistry(registryAddr).getCoreAddr()
        require(amount > 0, "zero amount invalid");
        require(
            amount <= token().balanceOf(beneficiary),
            "amount exceeds token balance"
        );
        require(
            token().approve(address(yoloCoreAddress), amount),
            "locked token approve failed"
        );
        require(
            IYoloCore(yoloCoreAddress).requestAddLiquidity(amount),
            "addRequest unsuccessful"
        );

        return true;
    }

    function withdrawRequest(uint256 amount)
        external
        onlyBeneficiary
        returns (bool)
    {
        // TODO: review
        // require(
        //     amount <= IYoloCore(yoloCoreAddress).balanceOf(beneficiary),
        //     "withdraw amount exceeds user platform balance"
        // );
        require(
            IYoloCore(yoloCoreAddress).requestRemoveLiquidity(amount),
            "removeRequest unsuccessful"
        );

        return true;
    }
}
