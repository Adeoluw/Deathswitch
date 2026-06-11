// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./DeathSwitch.sol";

contract DeathSwitchFactory {
    mapping(address => address) private _switches;

    event SwitchCreated(address indexed owner, address indexed switchAddress);

    function createSwitch(uint256 checkInInterval, uint256 gracePeriod) external returns (address) {
        require(_switches[msg.sender] == address(0), "Factory: switch already exists");
        DeathSwitch ds = new DeathSwitch(msg.sender, checkInInterval, gracePeriod);
        _switches[msg.sender] = address(ds);
        emit SwitchCreated(msg.sender, address(ds));
        return address(ds);
    }

    function getUserSwitch(address owner) external view returns (address) {
        return _switches[owner];
    }
}
