const contractsData = require("../configs/contracts-data.json");

const YoloEthereumUtilityTokens = artifacts.require(
  "YoloEthereumUtilityTokens"
);
const YoloPolygonUtilityTokens = artifacts.require("YoloPolygonUtilityTokens");
const Mock_RootChainManagerProxy = artifacts.require(
  "Mock_RootChainManagerProxy"
);
const Mock_ChildChainManagerProxy = artifacts.require(
  "Mock_ChildChainManagerProxy"
);
const Mock_IssuanceEthereum = artifacts.require("Mock_IssuanceEthereum");
const Mock_IssuancePolygon = artifacts.require("Mock_IssuancePolygon");
const Mock_MEthTokens = artifacts.require("Mock_MEthTokens");

const createRandomAddress = () => web3.eth.accounts.create().address;

module.exports = async function (deployer, network, accounts) {
  const admin = accounts[0];

  if (network !== "development" && network !== "soliditycoverage") {
    throw new Error("Stop! use this migration for development only!");
  }

  await deployer.deploy(Mock_MEthTokens, "mETH", "METH", admin);
  await deployer.deploy(Mock_ChildChainManagerProxy);
  await deployer.deploy(
    Mock_RootChainManagerProxy,
    Mock_ChildChainManagerProxy.address
  );

  await deployer.deploy(
    YoloEthereumUtilityTokens,
    contractsData.UTConfig.name,
    contractsData.UTConfig.symbol,
    admin
  );

  await deployer.deploy(
    YoloPolygonUtilityTokens,
    contractsData.UTConfig.name,
    contractsData.UTConfig.symbol,
    Mock_ChildChainManagerProxy.address
  );

  await deployer.deploy(
    Mock_IssuancePolygon,
    YoloPolygonUtilityTokens.address,
    Mock_MEthTokens.address,
    createRandomAddress()
  );

  // !!! see caveat below
  await deployer.deploy(
    Mock_IssuanceEthereum,
    YoloEthereumUtilityTokens.address,
    createRandomAddress(),
    createRandomAddress(),
    Mock_IssuancePolygon.address,
    Mock_RootChainManagerProxy.address,
    // !!! unit test kludge - roll predicate contract into manager
    Mock_RootChainManagerProxy.address
  );
};
