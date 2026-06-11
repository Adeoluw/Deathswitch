// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDeathSwitch {
    struct Beneficiary {
        address wallet;
        uint256 basisPoints;
        string label;
    }

    event CheckIn(address indexed owner, uint256 timestamp);
    event BeneficiaryAdded(address indexed wallet, uint256 basisPoints, string label);
    event BeneficiaryRemoved(address indexed wallet);
    event Triggered(uint256 timestamp);
    event Deposited(address indexed token, uint256 amount);
    event Withdrawn(address indexed token, uint256 amount);

    function checkIn() external;
    function addBeneficiary(address wallet, uint256 basisPoints, string calldata label) external;
    function removeBeneficiary(address wallet) external;
    function setTokenAllocation(address token, address[] calldata beneficiaryWallets) external;
    function depositNative() external payable;
    function depositERC20(address token, uint256 amount) external;
    function withdrawAll() external;
    function trigger() external;
    function getSwitchStatus() external view returns (
        uint256 lastCheckIn,
        uint256 nextCheckInDeadline,
        uint256 triggerDeadline,
        bool triggered,
        uint256 totalBeneficiaries
    );
}
