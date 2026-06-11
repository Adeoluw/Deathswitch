// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IDeathSwitch.sol";

contract DeathSwitch is IDeathSwitch, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public owner;
    uint256 public checkInInterval;
    uint256 public gracePeriod;
    uint256 public lastCheckIn;
    bool public triggered;
    bool public paused;

    Beneficiary[] private _beneficiaries;
    // wallet => 1-based index (0 = not found)
    mapping(address => uint256) private _beneficiaryIndex;
    address[] private _trackedTokens;
    mapping(address => address[]) private _tokenBeneficiaries;

    modifier onlyOwner() {
        require(msg.sender == owner, "DeathSwitch: not owner");
        _;
    }

    modifier notTriggered() {
        require(!triggered, "DeathSwitch: already triggered");
        _;
    }

    constructor(address _owner, uint256 _checkInInterval, uint256 _gracePeriod) {
        require(_owner != address(0), "DeathSwitch: zero owner");
        require(_checkInInterval > 0, "DeathSwitch: zero interval");
        require(_gracePeriod > 0, "DeathSwitch: zero grace period");
        owner = _owner;
        checkInInterval = _checkInInterval;
        gracePeriod = _gracePeriod;
        lastCheckIn = block.timestamp;
    }

    function checkIn() external override onlyOwner notTriggered {
        lastCheckIn = block.timestamp;
        emit CheckIn(owner, block.timestamp);
    }

    function addBeneficiary(
        address wallet,
        uint256 basisPoints,
        string calldata label
    ) external override onlyOwner notTriggered {
        require(wallet != address(0), "DeathSwitch: zero wallet");
        require(basisPoints > 0, "DeathSwitch: zero basisPoints");
        require(_beneficiaryIndex[wallet] == 0, "DeathSwitch: already exists");

        uint256 total = basisPoints;
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            total += _beneficiaries[i].basisPoints;
        }
        require(total <= 10000, "DeathSwitch: exceeds 10000 basisPoints");

        _beneficiaries.push(Beneficiary({ wallet: wallet, basisPoints: basisPoints, label: label }));
        _beneficiaryIndex[wallet] = _beneficiaries.length;
        emit BeneficiaryAdded(wallet, basisPoints, label);
    }

    function removeBeneficiary(address wallet) external override onlyOwner notTriggered {
        uint256 idx = _beneficiaryIndex[wallet];
        require(idx != 0, "DeathSwitch: not found");

        uint256 i = idx - 1;
        uint256 last = _beneficiaries.length - 1;
        if (i != last) {
            _beneficiaries[i] = _beneficiaries[last];
            _beneficiaryIndex[_beneficiaries[i].wallet] = i + 1;
        }
        _beneficiaries.pop();
        delete _beneficiaryIndex[wallet];
        emit BeneficiaryRemoved(wallet);
    }

    function setTokenAllocation(
        address token,
        address[] calldata beneficiaryWallets
    ) external override onlyOwner notTriggered {
        if (_tokenBeneficiaries[token].length == 0 && beneficiaryWallets.length > 0) {
            _trackedTokens.push(token);
        }
        _tokenBeneficiaries[token] = beneficiaryWallets;
    }

    function depositNative() external payable override onlyOwner notTriggered {
        require(msg.value > 0, "DeathSwitch: zero value");
        emit Deposited(address(0), msg.value);
    }

    function depositERC20(address token, uint256 amount) external override onlyOwner notTriggered nonReentrant {
        require(token != address(0), "DeathSwitch: zero token");
        require(amount > 0, "DeathSwitch: zero amount");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        bool found = false;
        for (uint256 i = 0; i < _trackedTokens.length; i++) {
            if (_trackedTokens[i] == token) { found = true; break; }
        }
        if (!found) _trackedTokens.push(token);
        emit Deposited(token, amount);
    }

    function withdrawAll() external override onlyOwner notTriggered nonReentrant {
        uint256 nativeBal = address(this).balance;
        if (nativeBal > 0) {
            (bool ok, ) = payable(owner).call{value: nativeBal}("");
            require(ok, "DeathSwitch: native transfer failed");
            emit Withdrawn(address(0), nativeBal);
        }
        for (uint256 i = 0; i < _trackedTokens.length; i++) {
            address token = _trackedTokens[i];
            uint256 bal = IERC20(token).balanceOf(address(this));
            if (bal > 0) {
                IERC20(token).safeTransfer(owner, bal);
                emit Withdrawn(token, bal);
            }
        }
    }

    function trigger() external override notTriggered nonReentrant {
        require(
            block.timestamp > lastCheckIn + checkInInterval + gracePeriod,
            "DeathSwitch: grace period not elapsed"
        );
        require(_beneficiaries.length > 0, "DeathSwitch: no beneficiaries");

        uint256 totalBasisPoints = 0;
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            totalBasisPoints += _beneficiaries[i].basisPoints;
        }
        require(totalBasisPoints == 10000, "DeathSwitch: basisPoints must sum to 10000");

        triggered = true;

        // Native MNT
        uint256 nativeBal = address(this).balance;
        if (nativeBal > 0) {
            address[] memory nativeBens = _tokenBeneficiaries[address(0)];
            if (nativeBens.length > 0) {
                _distributeToSubset(address(0), nativeBal, nativeBens);
            } else {
                _distributeToAll(address(0), nativeBal);
            }
        }

        // ERC-20 tokens
        for (uint256 t = 0; t < _trackedTokens.length; t++) {
            address token = _trackedTokens[t];
            uint256 bal = IERC20(token).balanceOf(address(this));
            if (bal > 0) {
                address[] memory tokenBens = _tokenBeneficiaries[token];
                if (tokenBens.length > 0) {
                    _distributeToSubset(token, bal, tokenBens);
                } else {
                    _distributeToAll(token, bal);
                }
            }
        }

        emit Triggered(block.timestamp);
    }

    function _distributeToAll(address token, uint256 total) internal {
        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            uint256 share = (total * _beneficiaries[i].basisPoints) / 10000;
            if (share == 0) continue;
            _sendAsset(token, _beneficiaries[i].wallet, share);
        }
    }

    function _distributeToSubset(address token, uint256 total, address[] memory wallets) internal {
        uint256 subsetBasis = 0;
        for (uint256 j = 0; j < wallets.length; j++) {
            uint256 idx = _beneficiaryIndex[wallets[j]];
            if (idx != 0) subsetBasis += _beneficiaries[idx - 1].basisPoints;
        }
        if (subsetBasis == 0) return;
        for (uint256 j = 0; j < wallets.length; j++) {
            uint256 idx = _beneficiaryIndex[wallets[j]];
            if (idx == 0) continue;
            uint256 share = (total * _beneficiaries[idx - 1].basisPoints) / subsetBasis;
            if (share == 0) continue;
            _sendAsset(token, wallets[j], share);
        }
    }

    function _sendAsset(address token, address to, uint256 amount) internal {
        if (token == address(0)) {
            (bool ok, ) = payable(to).call{value: amount}("");
            require(ok, "DeathSwitch: native send failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    function getSwitchStatus() external view override returns (
        uint256 _lastCheckIn,
        uint256 nextCheckInDeadline,
        uint256 triggerDeadline,
        bool _triggered,
        uint256 totalBeneficiaries
    ) {
        return (
            lastCheckIn,
            lastCheckIn + checkInInterval,
            lastCheckIn + checkInInterval + gracePeriod,
            triggered,
            _beneficiaries.length
        );
    }

    function getBeneficiaries() external view returns (Beneficiary[] memory) {
        return _beneficiaries;
    }

    receive() external payable {}
}
