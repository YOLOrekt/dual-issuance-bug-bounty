/// this issuance test not revised for dual issuance yet

const { UTConfig } = require("../configs/contracts-data");
const { mulDivBN, advanceTimeAndBlock } = require("./utils/utils");
const {
  BN,
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");

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

// const { web3 } = require("@openzeppelin/test-helpers/src/setup");

const { ZERO_ADDRESS, ZERO_BYTES32, MAX_UINT256, MAX_INT256, MIN_INT256 } =
  constants;

const MINTER_ROLE = web3.utils.soliditySha3("MINTER_ROLE");

const bnTen = new BN("10", 10);
const bnNine = new BN("9", 10);
const bnFifty = new BN("50", 10);
const bnMillion = new BN("1000000", 10);
const bnDecimalPlaces = new BN("18", 10);
const tokenDecimals = bnTen.pow(bnDecimalPlaces);
const supplyInteger = bnTen.pow(bnNine);
const issuanceInteger = bnFifty.mul(bnMillion);
const totalIssuedToken = issuanceInteger.mul(tokenDecimals);
const totalTokenSupply = supplyInteger.mul(tokenDecimals);
console.log("total issued tokens:: ", totalIssuedToken.toString());
console.log(
  "total issued tokens (E18 + E7):: ",
  Number(totalIssuedToken.toString())
);

const gasMax = "8000000";
const zeroNumberString = "0";

const createRandomAddress = () => web3.eth.accounts.create().address;

describe("Issuance Contract Test", () => {
  let accounts,
    admin,
    investorOne,
    investorTwo,
    user1,
    user2,
    epochTimestamp,
    contributionOne,
    contributionTwo,
    totalContributions = 0;

  before(async () => {
    epochTimestamp = (await web3.eth.getBlock("latest")).timestamp;
    accounts = await web3.eth.getAccounts();
    admin = accounts[0]; // default account
    investorOne = accounts[1];
    investorTwo = accounts[2];
    user1 = accounts[3];
    user2 = accounts[4];
    unassociatedAccount = accounts[5];

    contributionOne = new BN("500", 10).mul(tokenDecimals);
    contributionTwo = new BN("7", 10).mul(tokenDecimals);
  });

  contract("Instantiation", async () => {
    it("Contracts instantiated as expected", async () => {
      const yoloEthereumUtilityTokens =
        await YoloEthereumUtilityTokens.deployed();
      const yoloPolygonUtilityTokens =
        await YoloPolygonUtilityTokens.deployed();
      const issuanceEthereum = await Mock_IssuanceEthereum.deployed();
      const issuancePolygon = await Mock_IssuancePolygon.deployed();

      assert.equal(
        await yoloEthereumUtilityTokens.name(),
        UTConfig.name,
        "Ethereum Utility Token name mismatch"
      );
      assert.equal(
        await yoloEthereumUtilityTokens.symbol(),
        UTConfig.symbol,
        "Ethereum Utility Token symbol mismatch"
      );
      assert.equal(
        (await yoloEthereumUtilityTokens.decimals()).toString(),
        bnDecimalPlaces.toString(),
        "Ethereum Utility Token symbol mismatch"
      );
      assert.equal(
        (await yoloEthereumUtilityTokens.totalSupply()).toString(),
        totalTokenSupply.toString(),
        "Ethereum Utility Token symbol mismatch"
      );

      assert.equal(
        await yoloPolygonUtilityTokens.name(),
        UTConfig.name,
        "Polygon Utility Token name mismatch"
      );
      assert.equal(
        await yoloPolygonUtilityTokens.symbol(),
        UTConfig.symbol,
        "Polygon Utility Token symbol mismatch"
      );
      assert.equal(
        (await yoloPolygonUtilityTokens.decimals()).toString(),
        bnDecimalPlaces.toString(),
        "Ethereum Utility Token symbol mismatch"
      );
      assert.equal(
        (await yoloPolygonUtilityTokens.totalSupply()).toString(),
        zeroNumberString,
        "Ethereum Utility Token symbol mismatch"
      );

      assert.equal(
        await issuanceEthereum.yoloEthereumTokenContract(),
        yoloEthereumUtilityTokens.address,
        "Mismatch in root token contract registered in IssuanceEthereum"
      );
      assert.equal(
        await issuanceEthereum.rootChainManagerContract(),
        Mock_RootChainManagerProxy.address,
        "Mismatch in rootChainManagerContract registered in IssuanceEthereum"
      );
      assert.equal(
        await issuanceEthereum.fxChildTunnel(),
        Mock_IssuancePolygon.address,
        "Mismatch in fxChildTunnel registered in IssuanceEthereum"
      );
      assert.notEqual(
        await issuanceEthereum.fxRoot(),
        ZERO_ADDRESS,
        "fxRoot contract address not set in IssuanceEthereum"
      );
      assert.notEqual(
        await issuanceEthereum.checkpointManager(),
        ZERO_ADDRESS,
        "Mismatch in checkPointManager address not set in IssuanceEthereum"
      );

      assert.equal(
        await issuancePolygon.yoloPolygonTokenContract(),
        yoloPolygonUtilityTokens.address,
        "Mismatch in child token contract registered in IssuancePolygon"
      );
      assert.equal(
        await issuancePolygon.mEthTokenContract(),
        Mock_MEthTokens.address,
        "Mismatch in child token contract registered in IssuancePolygon"
      );
      assert.notEqual(
        await issuancePolygon.fxChild(),
        ZERO_ADDRESS,
        "fxRoot contract address not set in IssuanceEthereum"
      );
    });
  });

  contract("Initialization requirements and values", async () => {
    let issuanceEthereum;
    let issuancePolygon;
    let yoloEthereumTokens;
    let yoloPolygonTokens;

    before(async () => {
      issuanceEthereum = await Mock_IssuanceEthereum.deployed();
      issuancePolygon = await Mock_IssuancePolygon.deployed();
      yoloEthereumTokens = await YoloEthereumUtilityTokens.deployed();
      yoloPolygonTokens = await YoloPolygonUtilityTokens.deployed();
    });

    it("IssuanceEthereum reverts on missing constructor address args", async () => {
      await expectRevert(
        Mock_IssuanceEthereum.new(
          ZERO_ADDRESS,
          createRandomAddress(),
          createRandomAddress(),
          Mock_IssuancePolygon.address,
          Mock_RootChainManagerProxy.address,
          Mock_RootChainManagerProxy.address
        ),
        "YOLO ethereum token contract address must be specified"
      );

      await expectRevert(
        Mock_IssuanceEthereum.new(
          YoloEthereumUtilityTokens.address,
          ZERO_ADDRESS,
          createRandomAddress(),
          Mock_IssuancePolygon.address,
          Mock_RootChainManagerProxy.address,
          Mock_RootChainManagerProxy.address
        ),
        "checkpointManager contract address must be specified"
      );

      await expectRevert(
        Mock_IssuanceEthereum.new(
          YoloEthereumUtilityTokens.address,
          createRandomAddress(),
          ZERO_ADDRESS,
          Mock_IssuancePolygon.address,
          Mock_RootChainManagerProxy.address,
          Mock_RootChainManagerProxy.address
        ),
        "fxRoot contract address must be specified"
      );

      await expectRevert(
        Mock_IssuanceEthereum.new(
          YoloEthereumUtilityTokens.address,
          createRandomAddress(),
          createRandomAddress(),
          ZERO_ADDRESS,
          Mock_RootChainManagerProxy.address,
          Mock_RootChainManagerProxy.address
        ),
        "fx child tunnel aka child issuance contract address must be specified"
      );

      await expectRevert(
        Mock_IssuanceEthereum.new(
          YoloEthereumUtilityTokens.address,
          createRandomAddress(),
          createRandomAddress(),
          Mock_IssuancePolygon.address,
          ZERO_ADDRESS,
          Mock_RootChainManagerProxy.address
        ),
        "root chain manager contract address must be specified"
      );

      await expectRevert(
        Mock_IssuanceEthereum.new(
          YoloEthereumUtilityTokens.address,
          createRandomAddress(),
          createRandomAddress(),
          Mock_IssuancePolygon.address,
          Mock_RootChainManagerProxy.address,
          ZERO_ADDRESS
        ),
        "erc20 predicate contract address must be specified"
      );
    });

    it("IssuancePolygon reverts on missing constructor address args", async () => {
      await expectRevert(
        Mock_IssuancePolygon.new(
          ZERO_ADDRESS,
          Mock_MEthTokens.address,
          createRandomAddress()
        ),
        "YOLO polygon token contract address must be specified"
      );

      await expectRevert(
        Mock_IssuancePolygon.new(
          YoloPolygonUtilityTokens.address,
          ZERO_ADDRESS,
          createRandomAddress()
        ),
        "mEth token contract address must be specified"
      );

      await expectRevert(
        Mock_IssuancePolygon.new(
          YoloPolygonUtilityTokens.address,
          Mock_MEthTokens.address,
          ZERO_ADDRESS
        ),
        "fxChild contract address must be specified"
      );
    });

    it("YOLO token contract reverts on missing constructor args", async () => {
      await expectRevert(
        YoloEthereumUtilityTokens.new("", UTConfig.symbol, admin),
        "token name must be specified"
      );

      await expectRevert(
        YoloEthereumUtilityTokens.new(UTConfig.name, "", admin),
        "token symbol must be specified"
      );

      await expectRevert(
        YoloEthereumUtilityTokens.new(
          UTConfig.name,
          UTConfig.symbol,
          ZERO_ADDRESS
        ),
        "ERC20: mint to the zero address"
      );
    });

    it("Owner should be admin", async () => {
      const issuanceEthereumOwner = await issuanceEthereum.owner();
      const issuancePolygonOwner = await issuancePolygon.owner();

      assert.equal(issuanceEthereumOwner, admin, "owner should be admin");
      assert.equal(issuancePolygonOwner, admin, "owner should be admin");
    });

    it("Admin should own 1 Billion token on ethereum token contract and none on Polygon ", async () => {
      const ownerYoloEthereumBalance = await yoloEthereumTokens.balanceOf(
        admin
      );
      const ownerYoloPolygonBalance = await yoloPolygonTokens.balanceOf(admin);

      assert.equal(
        ownerYoloEthereumBalance,
        totalTokenSupply.toString(),
        "admin mints 1 Billion YOLO for itself on Ethereum chain"
      );
      assert.equal(
        ownerYoloPolygonBalance,
        zeroNumberString,
        "admin should have no tokens on Polygon chain"
      );
    });

    it("Issuance sums should start at 0", async () => {
      const rootSum = await issuanceEthereum.rootSum();
      const childSum = await issuancePolygon.childSum();
      const childSumOnRoot = await issuanceEthereum.childSum();

      assert.equal(rootSum, zeroNumberString, "root sum not initialized to 0");
      assert.equal(
        childSum,
        zeroNumberString,
        "child sum not initialized to 0"
      );
      assert.equal(
        childSumOnRoot,
        zeroNumberString,
        "child sum not initialized to 0 on root contract"
      );
    });

    it("Issuance, redeem, and data flags initialized to false", async () => {
      const contributionOpenedEthereum =
        await issuanceEthereum.isContributionWindowOpen();
      const contributionClosedEthereum =
        await issuanceEthereum.isContributionWindowClosed();
      const canRedeemEthereum = await issuanceEthereum.isRedemptionRegimeOpen();
      const hasProcessedMessageFromChild =
        await issuanceEthereum.hasProcessedMessageFromChild();
      const hasRootToChildTransferRequest =
        await issuanceEthereum.hasRootToChildTransferRequest();

      const contributionOpenedPolygon =
        await issuancePolygon.isContributionWindowOpen();
      const contributionClosedPolygon =
        await issuancePolygon.isContributionWindowClosed();
      const canRedeemPolygon = await issuancePolygon.isRedemptionRegimeOpen();
      const isMessageSentToRoot = await issuancePolygon.isMessageSentToRoot();

      assert(
        !contributionOpenedEthereum,
        "isContributionWindowOpen Ethereum should be false"
      );
      assert(
        !contributionClosedEthereum,
        "isContributionWindowClosed Ethereum should be false"
      );
      assert(
        !hasProcessedMessageFromChild,
        "hasProcessedMessageFromChild should be false"
      );
      assert(
        !hasRootToChildTransferRequest,
        "hasRootToChildTransferRequest should be false"
      );
      assert(!canRedeemEthereum, false, "canRedeem should be false");
      assert(
        !contributionOpenedPolygon,
        "isContributionWindowOpen Polygon should be false"
      );
      assert(
        !contributionClosedPolygon,
        "isContributionWindowClosed Polygon should be false"
      );
      assert(!canRedeemPolygon, "canRedeem should be false");
      assert(!isMessageSentToRoot, "isMessageSentToRoot should be false");
    });

    it("Timestamp in contract should match test epoch", async () => {
      const deploymentTimestampEthereum = (
        await issuanceEthereum.deploymentTimestamp()
      ).toNumber();
      const deploymentTimestampPolygon = (
        await issuancePolygon.deploymentTimestamp()
      ).toNumber();

      // 1 second buffer subtracted due to async implementation constraint above
      assert(
        deploymentTimestampEthereum >= epochTimestamp - 1,
        "Instantiation block timestamp should be recorded in contract and later than or equal to environment setup"
      );
      assert(
        deploymentTimestampPolygon >= epochTimestamp - 1,
        "Instantiation block timestamp should be recorded in contract and later than or equal to environment setup"
      );
    });

    // n.b. must leave this unit test for last in contract block
    it("Can transfer admin/owner to another address if current admin", async () => {
      await issuanceEthereum.transferOwner(unassociatedAccount);
      await issuancePolygon.transferOwner(unassociatedAccount);

      const newOwerEthereum = await issuanceEthereum.owner();
      const newOwerPolygon = await issuancePolygon.owner();

      assert.equal(
        newOwerEthereum,
        unassociatedAccount,
        "new owner should be so-called unassociated account"
      );
      assert.equal(
        newOwerPolygon,
        unassociatedAccount,
        "new owner should be so-called unassociated account"
      );
    });
  });

  contract("Token contracts checks", async () => {
    let yoloEthereumTokens;
    let yoloPolygonTokens;

    before(async () => {
      yoloEthereumTokens = await YoloEthereumUtilityTokens.deployed();
      yoloPolygonTokens = await YoloPolygonUtilityTokens.deployed();
    });

    it("Transfers tokens on ethereum chain", async () => {
      assert.equal(
        (await yoloEthereumTokens.balanceOf(admin)).toString(),
        totalTokenSupply.toString(),
        "total issued token should be 1 Billion to admin"
      );

      await yoloEthereumTokens.transfer(investorOne, contributionOne);

      assert.equal(
        (await yoloEthereumTokens.balanceOf(investorOne)).toString(),
        contributionOne.toString(),
        "receiver should have correct token balance"
      );
    });

    it("Can approve token allowances", async () => {
      await yoloEthereumTokens.approve(investorTwo, contributionTwo);

      assert.equal(
        (await yoloEthereumTokens.allowance(admin, investorTwo)).toString(),
        contributionTwo.toString(),
        "allowance should match approval amount"
      );
    });

    it("Cannot spend more than allowance", async () => {
      await expectRevert(
        yoloEthereumTokens.transferFrom(
          admin,
          unassociatedAccount,
          contributionTwo.add(new BN("1")),
          { from: investorTwo }
        ),
        "ERC20: transfer amount exceeds allowance"
      );
    });

    it("Can spend allowance or less", async () => {
      const contributionTwoLessOneWei = contributionTwo.sub(new BN("1"));
      const oneWei = "1";
      yoloEthereumTokens.transferFrom(
        admin,
        unassociatedAccount,
        contributionTwoLessOneWei,
        { from: investorTwo }
      );

      assert.equal(
        (await yoloEthereumTokens.balanceOf(unassociatedAccount)).toString(),
        contributionTwoLessOneWei.toString(),
        "transfer amount not as expected"
      );

      assert.equal(
        (await yoloEthereumTokens.allowance(admin, investorTwo)).toString(),
        oneWei,
        "allowance should match approval amount less transfer -> one wei"
      );
    });
  });

  contract(
    "Issuance window, processing data, and redemption window events",
    async () => {
      let issuanceEthereum;
      let issuancePolygon;
      let yoloEthereumTokens;
      let yoloPolygonTokens;
      let rootChainManagerProxy;
      let childChainManagerProxy;

      before(async () => {
        issuanceEthereum = await Mock_IssuanceEthereum.deployed();
        issuancePolygon = await Mock_IssuancePolygon.deployed();
        yoloEthereumTokens = await YoloEthereumUtilityTokens.deployed();
        yoloPolygonTokens = await YoloPolygonUtilityTokens.deployed();
        rootChainManagerProxy = await Mock_RootChainManagerProxy.deployed();
        childChainManagerProxy = await Mock_ChildChainManagerProxy.deployed();
      });

      it("Emits expected event after opening issuance window", async () => {
        await yoloEthereumTokens.transfer(
          issuanceEthereum.address,
          totalIssuedToken
        );
        const receiptEthereum = await issuanceEthereum.openContributionWindow();
        const receiptPolygon = await issuancePolygon.openContributionWindow();

        expectEvent(receiptEthereum, "ContributionWindowOpened", {
          authorizer: admin,
        });
        expectEvent(receiptPolygon, "ContributionWindowOpened", {
          authorizer: admin,
        });
      });

      it("Emits expected event after closing issuance window", async () => {
        const receiptEthereum =
          await issuanceEthereum.closeContributionWindow();
        const receiptPolygon = await issuancePolygon.closeContributionWindow();

        expectEvent(receiptEthereum, "ContributionWindowClosed", {
          authorizer: admin,
          value: zeroNumberString,
        });
        expectEvent(receiptPolygon, "ContributionWindowClosed", {
          authorizer: admin,
          value: zeroNumberString,
        });
        expectEvent(receiptPolygon, "MessageSent", {
          message: web3.eth.abi.encodeParameter("uint256", "0"),
        });
      });

      it("Emits expected event after opening redemption window, following closing of issuance window", async () => {
        await rootChainManagerProxy.setRootIssuanceAddress(
          issuanceEthereum.address
        );
        await childChainManagerProxy.setPolygonTokenAddress(
          yoloPolygonTokens.address
        );
        await yoloEthereumTokens.approve(
          Mock_RootChainManagerProxy.address,
          MAX_UINT256
        );

        // !!! calling mock override
        // must be greated than 0 transfer according to ERC20
        // will move all tokens over in this test
        await issuanceEthereum.receiveMessage(
          web3.eth.abi.encodeParameter("uint256", "1")
        );
        await issuanceEthereum.depositOnChildIssuanceContract();

        const receiptEthereum = await issuanceEthereum.openRedemptionRegime();
        const receiptPolygon = await issuancePolygon.openRedemptionRegime();

        expectEvent(receiptEthereum, "RedemptionWindowOpened", {
          authorizer: admin,
          contributionValue: zeroNumberString,
          allocatedTokens: zeroNumberString,
        });
        expectEvent(receiptPolygon, "RedemptionWindowOpened", {
          authorizer: admin,
          contributionValue: zeroNumberString,
          allocatedTokens: totalIssuedToken,
        });
      });
    }
  );

  contract("Timestamp based logic", async () => {
    let issuanceEthereum;
    let issuancePolygon;
    let yoloEthereumTokens;
    let yoloPolygonTokens;
    let rootChainManagerProxy;
    let childChainManagerProxy;

    before(async () => {
      issuanceEthereum = await Mock_IssuanceEthereum.deployed();
      issuancePolygon = await Mock_IssuancePolygon.deployed();
      yoloEthereumTokens = await YoloEthereumUtilityTokens.deployed();
      yoloPolygonTokens = await YoloPolygonUtilityTokens.deployed();
      rootChainManagerProxy = await Mock_RootChainManagerProxy.deployed();
      childChainManagerProxy = await Mock_ChildChainManagerProxy.deployed();
    });

    it("public can open after time advances 60 days after contribution close", async () => {
      await rootChainManagerProxy.setRootIssuanceAddress(
        issuanceEthereum.address
      );
      await childChainManagerProxy.setPolygonTokenAddress(
        yoloPolygonTokens.address
      );

      await yoloEthereumTokens.transfer(
        issuanceEthereum.address,
        totalIssuedToken
      );

      await issuanceEthereum.openContributionWindow();
      await issuancePolygon.openContributionWindow();

      // mock kludge for token predicate contract
      await yoloEthereumTokens.approve(
        Mock_RootChainManagerProxy.address,
        MAX_UINT256
      );

      await issuanceEthereum.closeContributionWindow();
      await issuancePolygon.closeContributionWindow();

      // !!! calling mock override
      // must be greated than 0 transfer according to ERC20
      // will move all tokens over in this test
      await issuanceEthereum.receiveMessage(
        web3.eth.abi.encodeParameter("uint256", "1")
      );
      await issuanceEthereum.depositOnChildIssuanceContract();

      await expectRevert(
        issuanceEthereum.openRedemptionRegime({ from: unassociatedAccount }),
        "cannot open redemption window unless owner or 60 days since deployment"
      );

      await expectRevert(
        issuancePolygon.openRedemptionRegime({ from: unassociatedAccount }),
        "cannot open redemption window unless owner or 60 days since deployment"
      );

      const contributionStartTimestamp = (
        await issuanceEthereum.contributionStartTimestamp()
      ).toNumber();
      const timestamp = (await web3.eth.getBlock("latest")).timestamp;
      console.log("first time:: ", timestamp);
      console.log("canRedeemWindowTimestamp:: ", contributionStartTimestamp);

      const daysAdvanceAmount =
        60 * 24 * 60 * 60 - (timestamp - contributionStartTimestamp) + 1; // add one second past 60 days
      await advanceTimeAndBlock(daysAdvanceAmount);

      const newTimestamp = (await web3.eth.getBlock("latest")).timestamp;
      console.log("new time::: ", newTimestamp);

      await issuanceEthereum.openRedemptionRegime({
        from: unassociatedAccount,
      });

      // deployed before issuanceEthereum so seasoned more aka should work
      await issuancePolygon.openRedemptionRegime({
        from: unassociatedAccount,
      });

      assert(
        await issuanceEthereum.isRedemptionRegimeOpen(),
        "redemption regime should be open"
      );
      assert(
        await issuancePolygon.isRedemptionRegimeOpen(),
        "redemption regime should be open"
      );
    });
  });

  contract("Restricted actions", async () => {
    let issuanceEthereum;
    let issuancePolygon;
    let yoloEthereumTokens;
    let yoloPolygonTokens;
    let rootChainManagerProxy;
    let childChainManagerProxy;

    before(async () => {
      issuanceEthereum = await Mock_IssuanceEthereum.deployed();
      issuancePolygon = await Mock_IssuancePolygon.deployed();
      yoloEthereumTokens = await YoloEthereumUtilityTokens.deployed();
      yoloPolygonTokens = await YoloPolygonUtilityTokens.deployed();
      rootChainManagerProxy = await Mock_RootChainManagerProxy.deployed();
      childChainManagerProxy = await Mock_ChildChainManagerProxy.deployed();
    });

    it("Cannot transfer admin/owner without admin privelages", async () => {
      await expectRevert(
        issuanceEthereum.transferOwner(unassociatedAccount, {
          from: unassociatedAccount,
        }),
        "Must have admin role to invoke"
      );
      await expectRevert(
        issuancePolygon.transferOwner(unassociatedAccount, {
          from: unassociatedAccount,
        }),
        "Must have admin role to invoke"
      );
    });

    it("Cannot open contribution window without tokens in IssuanceEthereum", async () => {
      await expectRevert(
        issuanceEthereum.openContributionWindow(),
        "50 million tokens must be transferred to issuance contract before issuance is started"
      );
      // issuancePolygon should not revert de facto
    });

    it("Cannot open contribution window without admin privelages", async () => {
      await expectRevert(
        issuanceEthereum.openContributionWindow({ from: unassociatedAccount }),
        "Must have admin role to invoke"
      );

      await expectRevert(
        issuancePolygon.openContributionWindow({ from: unassociatedAccount }),
        "Must have admin role to invoke"
      );
    });

    it("Cannot close contribution window before opening of contribution window", async () => {
      await expectRevert(
        issuanceEthereum.closeContributionWindow(),
        "contribution window must be open before closing"
      );
      await expectRevert(
        issuancePolygon.closeContributionWindow(),
        "contribution window must be open before closing"
      );
    });

    it("Cannot open redemption window before closing of issuance window", async () => {
      await expectRevert(
        issuanceEthereum.openRedemptionRegime(),
        "requires token transfer request to child and updated root token pool amount"
      );
      await expectRevert(
        issuancePolygon.openRedemptionRegime(),
        "contribution window must be closed"
      );
    });

    it("Cannot open redemption window before closing of issuance window", async () => {
      await expectRevert(
        issuanceEthereum.openRedemptionRegime(),
        "requires token transfer request to child and updated root token pool amount"
      );
      await expectRevert(
        issuancePolygon.openRedemptionRegime(),
        "contribution window must be closed"
      );
    });

    it("Cannot redeem tokens before redemption window", async () => {
      await expectRevert(
        issuanceEthereum.redeemTokens({ from: investorOne }),
        "redemption window is not open yet"
      );

      await expectRevert(
        issuancePolygon.redeemTokens({ from: investorOne }),
        "redemption window is not open yet"
      );
    });

    it("Cannot redeem tokens before redemption window with admin either", async () => {
      await expectRevert(
        issuanceEthereum.redeemTokens(),
        "redemption window is not open yet"
      );

      await expectRevert(
        issuancePolygon.redeemTokens(),
        "redemption window is not open yet"
      );
    });

    it("Opening contribution window by admin...", async () => {
      // issuancePolygon should not revert as does not check ethereum side token state
      await issuancePolygon.openContributionWindow();

      // transfer tokens into
      await yoloEthereumTokens.transfer(
        issuanceEthereum.address,
        totalIssuedToken
      );

      await issuanceEthereum.openContributionWindow();
    });

    it("Cannot close contribution window without admin privelages", async () => {
      await expectRevert(
        issuanceEthereum.closeContributionWindow({ from: unassociatedAccount }),
        "Must have admin role to invoke"
      );

      await expectRevert(
        issuancePolygon.closeContributionWindow({ from: unassociatedAccount }),
        "Must have admin role to invoke"
      );
    });

    it("Cannot redeem tokens with issuance window closed, without redemption window open", async () => {
      await issuanceEthereum.closeContributionWindow();
      await issuancePolygon.closeContributionWindow();

      await expectRevert(
        issuanceEthereum.redeemTokens(),
        "redemption window is not open yet"
      );

      await expectRevert(
        issuancePolygon.redeemTokens(),
        "redemption window is not open yet"
      );
    });

    it("Cannot migrate investment fund without registered fund recipient", async () => {
      await expectRevert(
        issuanceEthereum.migrateInvestmentFund(unassociatedAccount),
        "recipient must match registered fund receiver!"
      );

      await expectRevert(
        issuancePolygon.migrateInvestmentFund(unassociatedAccount),
        "recipient must match registered fund receiver!"
      );
    });

    it("Only admin can register fund recipient", async () => {
      await expectRevert(
        issuanceEthereum.registerFundRecipient(admin, {
          from: unassociatedAccount,
        }),
        "Must have admin role to invoke"
      );

      await expectRevert(
        issuancePolygon.migrateInvestmentFund(admin, {
          from: unassociatedAccount,
        }),
        "Must have admin role to invoke"
      );
    });

    it("Investment fund recipient address must match registered fund recipient", async () => {
      await issuanceEthereum.registerFundRecipient(unassociatedAccount);
      await issuancePolygon.registerFundRecipient(unassociatedAccount);

      await expectRevert(
        issuanceEthereum.migrateInvestmentFund(admin),
        "recipient must match registered fund receiver!"
      );

      await expectRevert(
        issuancePolygon.migrateInvestmentFund(admin),
        "recipient must match registered fund receiver!"
      );
    });

    it("Cannot migrate investment fund to zero address", async () => {
      await expectRevert(
        issuanceEthereum.migrateInvestmentFund(ZERO_ADDRESS),
        "recipient cannot be zero address"
      );

      await expectRevert(
        issuancePolygon.migrateInvestmentFund(ZERO_ADDRESS),
        "recipient cannot be zero address"
      );
    });

    it("Public cannot open redemption window within 60 days of closing issuance window", async () => {
      await rootChainManagerProxy.setRootIssuanceAddress(
        issuanceEthereum.address
      );
      await childChainManagerProxy.setPolygonTokenAddress(
        yoloPolygonTokens.address
      );

      // !!! calling mock override
      // must be greated than 0 transfer according to ERC20
      // will move all tokens over in this test
      await issuanceEthereum.receiveMessage(
        web3.eth.abi.encodeParameter("uint256", "1")
      );
      await issuanceEthereum.depositOnChildIssuanceContract();

      await expectRevert(
        issuanceEthereum.openRedemptionRegime({ from: unassociatedAccount }),
        "cannot open redemption window unless owner or 60 days since deployment"
      );
      await expectRevert(
        issuancePolygon.openRedemptionRegime({ from: unassociatedAccount }),
        "cannot open redemption window unless owner or 60 days since deployment"
      );
    });
  });

  // contract("One investor", async () => {
  //   it("Move Yolo tokens to contract", async () => {
  //     const UTInstance = await YoloEthereumUtilityTokens.deployed();
  //     const IssuanceInstance = await Issuance.deployed();
  //     await UTInstance.transfer(
  //       IssuanceInstance.address,
  //       totalIssuedToken.toString()
  //     );
  //   });

  //   it("Contribution emits event", async () => {
  //     const IssuanceInstance = await Issuance.deployed();

  //     const receipt = await IssuanceInstance.contribute({
  //       from: investorOne,
  //       value: contributionOne,
  //     });

  //     expectEvent(receipt, "ContributionMade", {
  //       contributor: investorOne,
  //       value: contributionOne,
  //     });
  //   });

  //   it("Sum variable is equivalent to first contribution", async () => {
  //     const IssuanceInstance = await Issuance.deployed();

  //     const sum = await IssuanceInstance.sum();
  //     console.log("sum is:: ", sum.toString());

  //     assert.equal(
  //       sum.toString(),
  //       contributionOne.toString(),
  //       "first contribution should be equivalent to sum"
  //     );
  //   });

  //   it("Cannot claim after issuance window closed", async () => {
  //     const IssuanceInstance = await Issuance.deployed();
  //     await IssuanceInstance.endTokenIssuance();

  //     await expectRevert(
  //       IssuanceInstance.redeemTokens({ from: investorOne }),
  //       "redemption window is not open yet"
  //     );
  //   });

  //   it("Claim check false before redemption", async () => {
  //     const IssuanceInstance = await Issuance.deployed();
  //     const hasClaimed = await IssuanceInstance.claimsCheck(investorOne);

  //     assert.equal(
  //       hasClaimed,
  //       false,
  //       "claim should be false prior to redemption"
  //     );
  //   });

  //   it("Redeem tokens", async () => {
  //     const IssuanceInstance = await Issuance.deployed();
  //     await IssuanceInstance.openRedemptionRegime();

  //     // only one investorOne, so should receive all tokens
  //     const calculatedTokenAmountBN = mulDivBN(
  //       contributionOne,
  //       totalIssuedToken,
  //       contributionOne
  //     );

  //     const calculatedTokenAmount = calculatedTokenAmountBN.toString();

  //     const receipt = await IssuanceInstance.redeemTokens({
  //       from: investorOne,
  //     });

  //     expectEvent(receipt, "TokensRedeemed", {
  //       redeemer: investorOne,
  //       value: calculatedTokenAmount,
  //     });
  //   });

  //   it("Claim already executed", async () => {
  //     const IssuanceInstance = await Issuance.deployed();

  //     await expectRevert(
  //       IssuanceInstance.redeemTokens({ from: investorOne }),
  //       "prior claim executed"
  //     );
  //   });
  // });

  // contract("Two contributors", async () => {
  //   it("Move Yolo tokens to contract", async () => {
  //     const UTInstance = await YoloEthereumUtilityTokens.deployed();
  //     const IssuanceInstance = await Issuance.deployed();
  //     const issuanceAddress = IssuanceInstance.address;
  //     await UTInstance.transfer(issuanceAddress, totalIssuedToken.toString());

  //     await IssuanceInstance.contribute({
  //       from: investorOne,
  //       value: contributionOne,
  //     });

  //     await IssuanceInstance.contribute({
  //       from: investorTwo,
  //       value: contributionTwo,
  //     });
  //   });

  //   it("Sum variable is equivalent to total contributions", async () => {
  //     const IssuanceInstance = await Issuance.deployed();
  //     const sum = (await IssuanceInstance.sum()).toString();
  //     const contributedSum = contributionOne.add(contributionTwo).toString();

  //     assert.equal(
  //       sum,
  //       contributedSum,
  //       "first contribution should be equivalent to sum"
  //     );
  //   });

  //   it("Cannot claim right after issuance window closed", async () => {
  //     const IssuanceInstance = await Issuance.deployed();
  //     await IssuanceInstance.endTokenIssuance();

  //     await expectRevert(
  //       IssuanceInstance.redeemTokens({ from: investorTwo }),
  //       "redemption window is not open yet"
  //     );
  //   });

  //   it("Investor claim check is false before token redemption", async () => {
  //     const IssuanceInstance = await Issuance.deployed();
  //     const hasClaimed = await IssuanceInstance.claimsCheck(investorTwo);

  //     assert.equal(
  //       hasClaimed,
  //       false,
  //       "claim should be false prior to redemption"
  //     );
  //   });

  //   it("Redeem tokens", async () => {
  //     const IssuanceInstance = await Issuance.deployed();
  //     await IssuanceInstance.openRedemptionRegime();
  //     const sum = await IssuanceInstance.sum();

  //     console.log("cantributionOne toNumber:: ", contributionOne.toNumber());
  //     console.log(
  //       "totalIssued string to number:: ",
  //       Number(totalIssuedToken.toString())
  //     );

  //     console.log("two contrib sum:: ", sum.toString());
  //     console.log("contributionTwo:: ", contributionTwo.toNumber());
  //     console.log("number sum:: ", sum.toString());

  //     // only one investorOne, so should receive all tokens
  //     const calculatedTokenAmount = mulDivBN(
  //       totalIssuedToken,
  //       contributionTwo,
  //       sum
  //     );

  //     const receipt = await IssuanceInstance.redeemTokens({
  //       from: investorTwo,
  //     });

  //     expectEvent(receipt, "TokensRedeemed", {
  //       redeemer: investorTwo,
  //       value: calculatedTokenAmount,
  //     });
  //   });

  //   it("Investor claim check following his redemption should be true", async () => {
  //     const IssuanceInstance = await Issuance.deployed();
  //     const hasClaimed = await IssuanceInstance.claimsCheck(investorTwo);

  //     assert.equal(
  //       hasClaimed,
  //       true,
  //       "claim should be false prior to redemption"
  //     );
  //   });

  //   it("A second investor's claim check should be false before redemption", async () => {
  //     const IssuanceInstance = await Issuance.deployed();
  //     const hasClaimed = await IssuanceInstance.claimsCheck(investorOne);

  //     assert.equal(
  //       hasClaimed,
  //       false,
  //       "claim should be false prior to redemption"
  //     );
  //   });

  //   it("Claim already executed", async () => {
  //     const IssuanceInstance = await Issuance.deployed();

  //     await expectRevert(
  //       IssuanceInstance.redeemTokens({ from: investorTwo }),
  //       "prior claim executed"
  //     );
  //   });

  //   it("Last contributor redeems tokens", async () => {
  //     const IssuanceInstance = await Issuance.deployed();
  //     await IssuanceInstance.openRedemptionRegime();
  //     const sum = await IssuanceInstance.sum();

  //     console.log("two contrib sum:: ", sum.toString());
  //     console.log("contributionTwo:: ", contributionOne.toNumber());
  //     console.log("number sum:: ", Number(sum));

  //     // only one investorOne, so should receive all tokens
  //     const calculatedTokenAmount = mulDivBN(
  //       totalIssuedToken,
  //       contributionOne,
  //       sum
  //     );

  //     console.log("calculated token amt:: ", calculatedTokenAmount.toString());

  //     const receipt = await IssuanceInstance.redeemTokens({
  //       from: investorOne,
  //     });

  //     expectEvent(receipt, "TokensRedeemed", {
  //       redeemer: investorOne,
  //       value: calculatedTokenAmount,
  //     });
  //   });

  //   it("Migrate investment fund should total sum", async () => {
  //     const IssuanceInstance = await Issuance.deployed();
  //     const issuanceAddress = IssuanceInstance.address;
  //     const totalRaised = await web3.eth.getBalance(issuanceAddress);

  //     console.log("total raised:: ", totalRaised);

  //     const receipt = await IssuanceInstance.migrateInvestmentFund(admin);

  //     expectEvent(receipt, "InvestmentFundTransferred", {
  //       recipient: admin,
  //       value: totalRaised,
  //     });
  //   });

  //   it("Cannot return stagnant tokens before 180 days", async () => {
  //     const IssuanceInstance = await Issuance.deployed();

  //     await expectRevert(
  //       IssuanceInstance.returnStagnantTokens(admin),
  //       "cannot return tokens before 60 days after redemption window"
  //     );
  //   });

  //   it("Cannot return stagnant tokens at 179.99 days!", async () => {
  //     const IssuanceInstance = await Issuance.deployed();

  //     const timestamp = (await web3.eth.getBlock("latest")).timestamp;
  //     const canRedeemWindowTimestamp = (
  //       await IssuanceInstance.redemptionWindowTimestamp()
  //     ).toNumber();
  //     console.log("first time:: ", timestamp);
  //     console.log("canRedeemWindowTimestamp:: ", canRedeemWindowTimestamp);

  //     const daysAdvanceAmount =
  //       60 * 24 * 60 * 60 - 1 - (timestamp - canRedeemWindowTimestamp); // just one second short

  //     await advanceTimeAndBlock(daysAdvanceAmount);
  //     const newTimestamp = (await web3.eth.getBlock("latest")).timestamp;
  //     console.log("new time::: ", newTimestamp);

  //     await expectRevert(
  //       IssuanceInstance.returnStagnantTokens(admin),
  //       "cannot return tokens before 60 days after redemption window"
  //     );
  //   });

  //   it("Can return stagnant tokens 60 days after can redeem", async () => {
  //     // note probably not worth returning dust if all that is left is a few wei
  //     const IssuanceInstance = await Issuance.deployed();
  //     const UTInstance = await YoloEthereumUtilityTokens.deployed();
  //     const issuanceAddress = IssuanceInstance.address;

  //     const timestamp = (await web3.eth.getBlock("latest")).timestamp;
  //     console.log("last timestamp:: ", timestamp);

  //     const daysAdvanceAmount = 2; // 60 days * 24 hours * 60 minutes * 60 seconds + 2 seconds

  //     const amountToReturn = await UTInstance.balanceOf(issuanceAddress);

  //     await advanceTimeAndBlock(daysAdvanceAmount);
  //     const afterAdvanceTimestamp = (await web3.eth.getBlock("latest"))
  //       .timestamp;
  //     console.log("after advance timestamp:: ", afterAdvanceTimestamp);

  //     const receipt = await IssuanceInstance.returnStagnantTokens(admin);
  //     const receiptTimestamp = (await web3.eth.getBlock("latest")).timestamp;
  //     console.log("after receipt timestamp:: ", receiptTimestamp);

  //     expectEvent(receipt, "StagnantTokensReturned", {
  //       recipient: admin,
  //       value: amountToReturn,
  //     });
  //   });
  // });

  // contract("Multiple contributors", async () => {
  //   before("Move Yolo tokens to contract", async () => {
  //     const UTInstance = await YoloEthereumUtilityTokens.deployed();
  //     const IssuanceInstance = await Issuance.deployed();
  //     const issuanceAddress = IssuanceInstance.address;
  //     await UTInstance.transfer(issuanceAddress, totalIssuedToken.toString());

  //     let contributionValue = 1;

  //     const contributionTxns = accounts.map((account) => {
  //       const txnPromise = IssuanceInstance.contribute({
  //         from: account,
  //         value: contributionValue,
  //       });
  //       totalContributions += contributionValue;
  //       contributionValue += 1;
  //       return txnPromise;
  //     });

  //     await Promise.all(contributionTxns);
  //   });

  //   it("Sum variable is equivalent to total contributions", async () => {
  //     const IssuanceInstance = await Issuance.deployed();
  //     const sum = (await IssuanceInstance.sum()).toString();
  //     const contributedSum = contributionOne.add(contributionTwo).toString();

  //     console.log("total check:: ", totalContributions);
  //     assert.equal(
  //       sum,
  //       totalContributions,
  //       "total contributions should be equivalent to sum"
  //     );
  //   });

  //   it("Cannot claim right after issuance window closed", async () => {
  //     const IssuanceInstance = await Issuance.deployed();
  //     await IssuanceInstance.endTokenIssuance();

  //     const redeemTxns = accounts.map(async (account) => {
  //       await expectRevert(
  //         IssuanceInstance.redeemTokens({ from: account }),
  //         "redemption window is not open yet"
  //       );
  //     });

  //     await Promise.all(redeemTxns);
  //   });

  // it("Investor claim check is false before token redemption", async () => {
  //   const IssuanceInstance = await Issuance.deployed();
  //   const hasClaimed = await IssuanceInstance.claimsCheck(investorTwo);

  //   assert.equal(
  //     hasClaimed,
  //     false,
  //     "claim should be false prior to redemption",
  //   );
  // });

  // it("Redeem tokens", async () => {
  //   const IssuanceInstance = await Issuance.deployed();
  //   await IssuanceInstance.openRedemptionRegime();
  //   const sum = await IssuanceInstance.sum();

  //   console.log("cantributionOne toNumber:: ", contributionOne.toNumber());
  //   console.log(
  //     "totalIssued string to number:: ",
  //     Number(totalIssuedToken.toString()),
  //   );

  //   console.log("two contrib sum:: ", sum.toString());
  //   console.log("contributionTwo:: ", contributionTwo.toNumber());
  //   console.log("number sum:: ", sum.toString());

  //   // only one investorOne, so should receive all tokens
  //   const calculatedTokenAmount = mulDivBN(
  //     totalIssuedToken,
  //     contributionTwo,
  //     sum,
  //   );

  //   const receipt = await IssuanceInstance.redeemTokens({
  //     from: investorTwo,
  //   });

  //   expectEvent(receipt, "TokensRedeemed", {
  //     redeemer: investorTwo,
  //     value: calculatedTokenAmount,
  //   });
  // });

  // it("Investor claim check following his redemption should be true", async () => {
  //   const IssuanceInstance = await Issuance.deployed();
  //   const hasClaimed = await IssuanceInstance.claimsCheck(investorTwo);

  //   assert.equal(
  //     hasClaimed,
  //     true,
  //     "claim should be false prior to redemption",
  //   );
  // });

  // it("A second investor's claim check should be false before redemption", async () => {
  //   const IssuanceInstance = await Issuance.deployed();
  //   const hasClaimed = await IssuanceInstance.claimsCheck(investorOne);

  //   assert.equal(
  //     hasClaimed,
  //     false,
  //     "claim should be false prior to redemption",
  //   );
  // });

  // it("Claim already executed", async () => {
  //   const IssuanceInstance = await Issuance.deployed();

  //   await expectRevert(
  //     IssuanceInstance.redeemTokens({ from: investorTwo }),
  //     "prior claim executed",
  //   );
  // });

  // it("Last contributor redeems tokens", async () => {
  //   const IssuanceInstance = await Issuance.deployed();
  //   await IssuanceInstance.openRedemptionRegime();
  //   const sum = await IssuanceInstance.sum();

  //   console.log("two contrib sum:: ", sum.toString());
  //   console.log("contributionTwo:: ", contributionOne.toNumber());
  //   console.log("number sum:: ", Number(sum));

  //   // only one investorOne, so should receive all tokens
  //   const calculatedTokenAmount = mulDivBN(
  //     totalIssuedToken,
  //     contributionOne,
  //     sum,
  //   );

  //   console.log("calculated token amt:: ", calculatedTokenAmount.toString());

  //   const receipt = await IssuanceInstance.redeemTokens({
  //     from: investorOne,
  //   });

  //   expectEvent(receipt, "TokensRedeemed", {
  //     redeemer: investorOne,
  //     value: calculatedTokenAmount,
  //   });
  // });

  // it("Migrate investment fund should total sum", async () => {
  //   const IssuanceInstance = await Issuance.deployed();
  //   const issuanceAddress = IssuanceInstance.address;
  //   const totalRaised = await web3.eth.getBalance(issuanceAddress);

  //   console.log("total raised:: ", totalRaised);

  //   const receipt = await IssuanceInstance.migrateInvestmentFund(admin);

  //   expectEvent(receipt, "InvestmentFundTransferred", {
  //     recipient: admin,
  //     value: totalRaised,
  //   });
  // });
  // });
});
