pragma solidity ^0.8.0;

abstract contract Ownable {
    address public owner;

    // Sets the original owner of
    // contract when it is deployed
    constructor() {
        owner = msg.sender;
    }

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    modifier restricted() {
        require(msg.sender == owner, "Must have admin role to invoke");
        _;
    }

    function transferOwner(address newOwner)
        external
        restricted
        returns (bool)
    {
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);

        return true;
    }
}
