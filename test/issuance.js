/// this issuance test not revised for dual issuance yet

const { UTConfig } = require("../configs/contracts-data");
const { mulDivBN, advanceTimeAndBlock } = require("./utils/utils");
const {
  BN,
  constants, // Common constants, like the zero address and largest integers
  expectEvent, // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require("@openzeppelin/test-helpers");
const { assertion } = require("@openzeppelin/test-helpers/src/expectRevert");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");

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

const bnOne = new BN("1", 10);
const bnTen = new BN("10", 10);
const bnNine = new BN("9", 10);
const bnFifty = new BN("50", 10);
const bnHundred = new BN("100", 10);
const bnMillion = new BN("1000000", 10);
const bnDecimalPlaces = new BN("18", 10);
const tokenDecimals = bnTen.pow(bnDecimalPlaces);
const supplyInteger = bnTen.pow(bnNine);
const issuanceInteger = bnFifty.mul(bnMillion);
const totalIssuedToken = issuanceInteger.mul(tokenDecimals);
const totalTokenSupply = supplyInteger.mul(tokenDecimals);
const minimumContributionAmount = tokenDecimals.div(bnHundred);
console.log("total issued tokens:: ", totalIssuedToken.toString());
console.log(
  "total issued tokens (E18 + E7):: ",
  Number(totalIssuedToken.toString())
);

const gasMax = "8000000";
const zeroNumberString = "0";
const oneWei = "1";

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

      it("Migrates investment fund", async () => {
        await issuanceEthereum.registerFundRecipient(unassociatedAccount);
        await issuancePolygon.registerFundRecipient(unassociatedAccount);

        const receiptEthereum = await issuanceEthereum.migrateInvestmentFund(
          unassociatedAccount
        );
        const receiptPolygon = await issuancePolygon.migrateInvestmentFund(
          unassociatedAccount
        );

        expectEvent(receiptEthereum, "InvestmentFundTransferred", {
          recipient: unassociatedAccount,
          value: zeroNumberString,
        });

        expectEvent(receiptPolygon, "InvestmentFundTransferred", {
          recipient: unassociatedAccount,
          value: zeroNumberString,
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

    it("Cannot contribute before window opened", async () => {
      await expectRevert(
        issuanceEthereum.contribute({ from: investorOne, value: oneWei }),
        "contribution window has not opened"
      );

      await expectRevert(
        issuancePolygon.contribute(oneWei, { from: investorOne }),
        "contribution window has not opened"
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

    it("Cannot return YOLO tokens from issuanceEthereum once window open", async () => {
      await expectRevert(
        issuanceEthereum.returnYoloTokens(unassociatedAccount, oneWei),
        "contribution window already opened"
      );
    });

    it("Cannot contribute less than 0.01 ether", async () => {
      const value = minimumContributionAmount.sub(bnOne);

      await expectRevert(
        issuanceEthereum.contribute({ from: investorOne, value }),
        "minimum contribution is 0.01 ether"
      );

      await expectRevert(
        issuancePolygon.contribute(value, {
          from: investorOne,
        }),
        "minimum contribution is 0.01 ether"
      );
    });

    it("Cannot contribute wrapped eth without approval", async () => {
      await expectRevert(
        issuancePolygon.contribute(minimumContributionAmount, {
          from: investorOne,
        }),
        "contributor must approve issuance contract via mEth token contract in order to contribute tokens"
      );
    });

    it("Cannot open contribution window again", async () => {
      await expectRevert(
        issuanceEthereum.openContributionWindow(),
        "contribution window already opened"
      );

      await expectRevert(
        issuancePolygon.openContributionWindow(),
        "contribution window already opened"
      );
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

    it("Contribution window must be provessed before depositOnChildIssuanceContract", async () => {
      await expectRevert(
        issuanceEthereum.depositOnChildIssuanceContract(),
        "contribution window must be closed"
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

    it("Cannot contribute after window closed", async () => {
      await expectRevert(
        issuanceEthereum.contribute({ from: investorOne, value: oneWei }),
        "contribution window has closed"
      );

      await expectRevert(
        issuancePolygon.contribute(oneWei, { from: investorOne }),
        "contribution window has closed"
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

    it("Only admin can migrate contributions", async () => {
      await expectRevert(
        issuanceEthereum.migrateInvestmentFund(admin, {
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

    it("Child sum must be provessed before depositOnChildIssuanceContract", async () => {
      await rootChainManagerProxy.setRootIssuanceAddress(
        issuanceEthereum.address
      );
      await childChainManagerProxy.setPolygonTokenAddress(
        yoloPolygonTokens.address
      );

      await expectRevert(
        issuanceEthereum.depositOnChildIssuanceContract(),
        "childSum must be processed from child first"
      );
    });

    it("Cannot call depositOnChildIssuanceContract more than once", async () => {
      // !!! calling mock override
      // must be greated than 0 transfer according to ERC20
      // will move all tokens over in this test
      await issuanceEthereum.receiveMessage(
        web3.eth.abi.encodeParameter("uint256", "1")
      );
      await issuanceEthereum.depositOnChildIssuanceContract();

      await expectRevert(
        issuanceEthereum.depositOnChildIssuanceContract(),
        "root to child transfer already requested"
      );
    });

    it("Public cannot open redemption window within 60 days of closing issuance window", async () => {
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

  contract("More restricted actions", async () => {
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

    it("Cannot open polygon contribution window with preallotted token", async () => {
      await childChainManagerProxy.setPolygonTokenAddress(
        yoloPolygonTokens.address
      );
      await childChainManagerProxy.depositToChild(
        issuancePolygon.address,
        oneWei
      );

      await expectRevert(
        issuancePolygon.openContributionWindow(),
        "No tokens must be transferred to issuance contract before issuance is started"
      );
    });
  });

  contract(
    "Miscellaneous - Token escape hatch and address setters",
    async () => {
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

      it("Cannot open polygon contribution window with preallotted token", async () => {
        await yoloEthereumTokens.transfer(issuanceEthereum.address, oneWei);

        await issuanceEthereum.returnYoloTokens(unassociatedAccount, oneWei);

        assert(
          (await yoloEthereumTokens.balanceOf(unassociatedAccount)).toString(),
          oneWei,
          "returned amount should be one wei"
        );
      });

      it("Predicate contract address setter behaves", async () => {
        await expectRevert(
          issuanceEthereum.setPredicateContractAddress(unassociatedAccount, {
            from: unassociatedAccount,
          }),
          "Must have admin role to invoke"
        );

        await expectRevert(
          issuanceEthereum.setPredicateContractAddress(ZERO_ADDRESS),
          "erc20 predicate contract address must be specified"
        );

        await issuanceEthereum.setPredicateContractAddress(unassociatedAccount),
          assert(
            await issuanceEthereum.predicateContractAddress(),
            unassociatedAccount,
            "predicate contract address should now be unassocitatedAccount"
          );
      });

      it("Root manager contract setter behaves", async () => {
        await expectRevert(
          issuanceEthereum.setRootManagerContract(unassociatedAccount, {
            from: unassociatedAccount,
          }),
          "Must have admin role to invoke"
        );

        await expectRevert(
          issuanceEthereum.setRootManagerContract(ZERO_ADDRESS),
          "root chain manager contract address must be specified"
        );

        await issuanceEthereum.setRootManagerContract(unassociatedAccount),
          assert(
            await issuanceEthereum.rootChainManagerContract(),
            unassociatedAccount,
            "root chain contract address should now be unassocitatedAccount"
          );
      });

      it("Fx Child contract setter behaves", async () => {
        await expectRevert(
          issuanceEthereum.setFxChildTunnel(unassociatedAccount, {
            from: unassociatedAccount,
          }),
          "Must have admin role to invoke"
        );

        await expectRevert(
          issuanceEthereum.setFxChildTunnel(ZERO_ADDRESS),
          "fx child tunnel aka child issuance contract address must be specified"
        );

        await issuanceEthereum.setFxChildTunnel(unassociatedAccount),
          assert(
            await issuanceEthereum.fxChildTunnel(),
            unassociatedAccount,
            "root chain contract address should now be unassocitatedAccount"
          );
      });

      it("Fx Root contract setter behaves", async () => {
        await expectRevert(
          issuanceEthereum.setFxRoot(unassociatedAccount, {
            from: unassociatedAccount,
          }),
          "Must have admin role to invoke"
        );

        await expectRevert(
          issuanceEthereum.setFxRoot(ZERO_ADDRESS),
          "fxRoot contract address must be specified"
        );

        await issuanceEthereum.setFxRoot(unassociatedAccount),
          assert(
            await issuanceEthereum.fxRoot(),
            unassociatedAccount,
            "fx root contract address should now be unassocitatedAccount"
          );
      });

      it("Checkpoint Manager contract setter behaves", async () => {
        await expectRevert(
          issuanceEthereum.setCheckpointManager(unassociatedAccount, {
            from: unassociatedAccount,
          }),
          "Must have admin role to invoke"
        );

        await expectRevert(
          issuanceEthereum.setCheckpointManager(ZERO_ADDRESS),
          "checkpoint manager contract address must be specified"
        );

        await issuanceEthereum.setCheckpointManager(unassociatedAccount),
          assert(
            await issuanceEthereum.fxRoot(),
            unassociatedAccount,
            "checkpoint manager contract address should now be unassocitatedAccount"
          );
      });

      it("YOLO Polygon Token contract setter behaves", async () => {
        await expectRevert(
          issuancePolygon.setYoloPolygonTokenContract(unassociatedAccount, {
            from: unassociatedAccount,
          }),
          "Must have admin role to invoke"
        );

        await expectRevert(
          issuancePolygon.setYoloPolygonTokenContract(ZERO_ADDRESS),
          "YOLO polygon token contract address must be specified"
        );

        await issuancePolygon.setYoloPolygonTokenContract(unassociatedAccount),
          assert(
            await issuancePolygon.yoloPolygonTokenContract(),
            unassociatedAccount,
            "YOLO polygon contract address should now be unassocitatedAccount"
          );
      });

      it("Matic Wrapped Eth Token contract setter behaves", async () => {
        await expectRevert(
          issuancePolygon.setMEthTokenContract(unassociatedAccount, {
            from: unassociatedAccount,
          }),
          "Must have admin role to invoke"
        );

        await expectRevert(
          issuancePolygon.setMEthTokenContract(ZERO_ADDRESS),
          "mEth token contract address must be specified"
        );

        await issuancePolygon.setMEthTokenContract(unassociatedAccount),
          assert(
            await issuancePolygon.mEthTokenContract(),
            unassociatedAccount,
            "wrapped Eth contract address should now be unassocitatedAccount"
          );
      });

      it("Fx Child contract setter behaves", async () => {
        await expectRevert(
          issuancePolygon.setFxChild(unassociatedAccount, {
            from: unassociatedAccount,
          }),
          "Must have admin role to invoke"
        );

        await expectRevert(
          issuancePolygon.setFxChild(ZERO_ADDRESS),
          "fxChild contract address must be specified"
        );

        await issuancePolygon.setFxChild(unassociatedAccount),
          assert(
            await issuancePolygon.fxChild(),
            unassociatedAccount,
            "Fx Child contract address should now be unassocitatedAccount"
          );
      });
    }
  );

  for (let i = 0; i < 3; i++) {
    const generateRandomContributionBN = (ethMax, ethDecimals) => {
      const ethFactor = ethMax * 10 ** ethDecimals;
      const randWhole = Math.round(ethFactor * Math.random()).toString();

      return new BN(randWhole)
        .mul(tokenDecimals)
        .div(new BN(10 ** ethDecimals));
    };

    contract(`Contributions simulator #${i + 1}`, async () => {
      let issuanceEthereum;
      let issuancePolygon;
      let yoloEthereumTokens;
      let yoloPolygonTokens;
      let mEthTokens;
      let rootChainManagerProxy;
      let childChainManagerProxy;
      const ethereumContributions = {};
      const polygonContributions = {};
      let ethereumTotalContribution = new BN("0");
      let polygonTotalContribution = new BN("0");

      before(async () => {
        issuanceEthereum = await Mock_IssuanceEthereum.deployed();
        issuancePolygon = await Mock_IssuancePolygon.deployed();
        yoloEthereumTokens = await YoloEthereumUtilityTokens.deployed();
        yoloPolygonTokens = await YoloPolygonUtilityTokens.deployed();
        mEthTokens = await Mock_MEthTokens.deployed();
        rootChainManagerProxy = await Mock_RootChainManagerProxy.deployed();
        childChainManagerProxy = await Mock_ChildChainManagerProxy.deployed();

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

        console.log(
          "ethereum tokens on contract before ",
          web3.utils.fromWei(
            await yoloEthereumTokens.balanceOf(issuanceEthereum.address),
            "ether"
          )
        );
      });

      it("Makes contributions from community", async () => {
        // const contributorsCount = Math.round(10 * Math.random() - 0.05);

        // simulate eth contribution up to 100 eth with 3 decimal places

        const ethereumContributionsPromises = accounts.map((account) => {
          const randEth = generateRandomContributionBN(100, 3);
          ethereumTotalContribution = ethereumTotalContribution.add(randEth);
          ethereumContributions[account] = randEth;

          return issuanceEthereum.contribute({
            from: account,
            value: randEth,
          });
        });

        const polygonContributionsPromises = accounts.map(async (account) => {
          const randEth = generateRandomContributionBN(100, 3);
          polygonTotalContribution = polygonTotalContribution.add(randEth);
          polygonContributions[account] = randEth;

          await mEthTokens.transfer(account, randEth);

          await mEthTokens.approve(issuancePolygon.address, randEth, {
            from: account,
          });

          return issuancePolygon.contribute(randEth, {
            from: account,
          });
        });

        console.log(
          "total eth con",
          web3.utils.fromWei(ethereumTotalContribution, "ether")
        );
        console.log(
          "total wrapped con",
          web3.utils.fromWei(polygonTotalContribution, "ether")
        );

        await Promise.all(ethereumContributionsPromises);
        await Promise.all(polygonContributionsPromises);

        const rootSum = await issuanceEthereum.rootSum();
        const childSum = await issuancePolygon.childSum();

        assert.equal(
          rootSum,
          ethereumTotalContribution.toString(),
          "root sum does not match expected ethereum contributions"
        );

        assert.equal(
          childSum,
          polygonTotalContribution.toString(),
          "child sum does not match expected polygon contributions"
        );

        const contributionBalancePromises = accounts.map(async (account) => {
          const ethereumContrib = await issuanceEthereum.contributorAmounts(
            account
          );
          const polygonContrib = await issuancePolygon.contributorAmounts(
            account
          );

          assert(
            ethereumContrib,
            ethereumContributions[account],
            "contribution amount on contract should match expected"
          );

          assert(
            polygonContrib,
            polygonContributions[account],
            "contribution amount on contract should match expected"
          );
        });

        await Promise.all(contributionBalancePromises);
      });

      it("Correct cross-chain token distributions", async () => {
        await issuanceEthereum.closeContributionWindow();
        await issuancePolygon.closeContributionWindow();

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

        console.log(
          "ethereum tokens on contract BEFORE ",
          web3.utils.fromWei(
            await yoloEthereumTokens.balanceOf(issuanceEthereum.address),
            "ether"
          )
        );

        const childSumProofMock = (await issuancePolygon.childSum()).toString();

        // !!! calling mock override
        // must be greated than 0 transfer according to ERC20
        // will move all tokens over in this test
        await issuanceEthereum.receiveMessage(
          web3.eth.abi.encodeParameter("uint256", childSumProofMock)
        );
        await issuanceEthereum.depositOnChildIssuanceContract();

        const expectedTotalCrossChainSum = ethereumTotalContribution.add(
          polygonTotalContribution
        );

        console.log(
          "cross total ",
          web3.utils.fromWei(expectedTotalCrossChainSum, "ether")
        );
        console.log(
          "ethereum tokens on contract AFTER ",
          web3.utils.fromWei(
            await yoloEthereumTokens.balanceOf(issuanceEthereum.address),
            "ether"
          )
        );

        const expectedEthereumTokens = mulDivBN(
          totalIssuedToken,
          ethereumTotalContribution,
          expectedTotalCrossChainSum
        );

        const expectedPolygonTokens = mulDivBN(
          totalIssuedToken,
          polygonTotalContribution,
          expectedTotalCrossChainSum
        );

        console.log(
          "expected ethereum side tokens ",
          web3.utils.fromWei(expectedEthereumTokens, "ether")
        );
        const issuanceEthereumTokenBalance = await yoloEthereumTokens.balanceOf(
          issuanceEthereum.address
        );

        const issuancePolygonTokenBalance = await yoloPolygonTokens.balanceOf(
          issuancePolygon.address
        );

        // there is a one wei discrepency between BN lib and EVM operations..
        assert(
          issuanceEthereumTokenBalance
            .sub(expectedEthereumTokens)
            .abs()
            .lte(bnOne),
          "issuanceEthereum token distribution does not match expected"
        );

        assert(
          issuancePolygonTokenBalance
            .sub(expectedPolygonTokens)
            .abs()
            .lte(bnOne),
          "issuancePolygon token distribution does not match expected"
        );

        assert(
          issuanceEthereumTokenBalance
            .add(issuancePolygonTokenBalance)
            .eq(totalIssuedToken),
          "total issued tokens must add up after cross chain transfer"
        );
      });

      it("Receive expected token fractions", async () => {
        let yoloEthSanityCheck = new BN("0");
        let yoloPolySanityCheck = new BN("0");

        await issuanceEthereum.openRedemptionRegime();
        await issuancePolygon.openRedemptionRegime();

        const issuanceEthereumTokenBalance = await yoloEthereumTokens.balanceOf(
          issuanceEthereum.address
        );

        const rootSum = await issuanceEthereum.rootSum();
        const childSum = await issuancePolygon.childSum();

        const issuancePolygonTokenBalance = await yoloPolygonTokens.balanceOf(
          issuancePolygon.address
        );

        const redemptionPromises = accounts.map(async (account) => {
          const ethereumContrib = await issuanceEthereum.contributorAmounts(
            account
          );

          const polygonContrib = await issuancePolygon.contributorAmounts(
            account
          );

          const expectedEthereumClaimAmount = mulDivBN(
            issuanceEthereumTokenBalance,
            ethereumContrib,
            rootSum
          );

          const expectedPolygonClaimAmount = mulDivBN(
            issuancePolygonTokenBalance,
            polygonContrib,
            childSum
          );

          const yoloEthBalBefore = await yoloEthereumTokens.balanceOf(account);
          await issuanceEthereum.redeemTokens({ from: account });
          const yoloEthBalAfter = await yoloEthereumTokens.balanceOf(account);
          const yoloEthRedemptionAmount = yoloEthBalAfter.sub(yoloEthBalBefore);
          yoloEthSanityCheck = yoloEthSanityCheck.add(yoloEthRedemptionAmount);
          // console.log(
          //   "yoloEth redemptions ",
          //   web3.utils.fromWei(yoloEthRedemptionAmount, "ether")
          // );

          const yoloPolBalBefore = await yoloPolygonTokens.balanceOf(account);
          await issuancePolygon.redeemTokens({ from: account });
          const yoloPolBalAfter = await yoloPolygonTokens.balanceOf(account);
          const polyEthRedemptionAmount = yoloPolBalAfter.sub(yoloPolBalBefore);
          yoloPolySanityCheck = yoloPolySanityCheck.add(
            polyEthRedemptionAmount
          );
          // console.log(
          //   "polyEth redemptions ",
          //   web3.utils.fromWei(polyEthRedemptionAmount, "ether")
          // );

          assert.equal(
            yoloEthRedemptionAmount.toString(),
            expectedEthereumClaimAmount.toString(),
            "claim amount on ethereum chain not as expected"
          );

          assert.equal(
            polyEthRedemptionAmount.toString(),
            expectedPolygonClaimAmount.toString(),
            "claim amount on polygon chain not as expected"
          );
        });

        await Promise.all(redemptionPromises);

        const totalSanityCheck = yoloEthSanityCheck.add(yoloPolySanityCheck);

        console.log(
          "token redemption totals ",
          web3.utils.fromWei(yoloEthSanityCheck, "ether"),
          web3.utils.fromWei(yoloPolySanityCheck, "ether"),
          web3.utils.fromWei(totalSanityCheck, "ether")
        );

        assert(
          totalIssuedToken.sub(totalSanityCheck).lt(bnHundred),
          "too much token dust, exceeds tolerance!!"
        );
      });

      it("Migrates investment fund", async () => {
        await issuanceEthereum.registerFundRecipient(unassociatedAccount);
        await issuancePolygon.registerFundRecipient(unassociatedAccount);

        const rootSum = await issuanceEthereum.rootSum();
        const childSum = await issuancePolygon.childSum();

        const ethBalanceBefore = await web3.eth.getBalance(unassociatedAccount);
        console.log("eth balance BEFORE: ", ethBalanceBefore);

        const wrappedEthBalanceBefore = await mEthTokens.balanceOf(
          unassociatedAccount
        );

        const contractEthBalance = await web3.eth.getBalance(
          issuanceEthereum.address
        );

        assert.equal(
          rootSum.toString(),
          contractEthBalance,
          "contract balance should match rootSum"
        );

        await issuanceEthereum.migrateInvestmentFund(unassociatedAccount);
        await issuancePolygon.migrateInvestmentFund(unassociatedAccount);

        const ethBalanceAfter = await web3.eth.getBalance(unassociatedAccount);
        console.log("eth balance AFTER: ", ethBalanceAfter);
        const wrappedEthBalanceAfter = await mEthTokens.balanceOf(
          unassociatedAccount
        );

        const ethGain = new BN(ethBalanceAfter).sub(new BN(ethBalanceBefore));
        const wrappedEthGain = new BN(wrappedEthBalanceAfter).sub(
          new BN(wrappedEthBalanceBefore)
        );

        assert.equal(
          ethGain.toString(),
          rootSum.toString(),
          "migrated eth does not match expected"
        );
        assert.equal(
          wrappedEthGain.toString(),
          childSum.toString(),
          "migrated wrapped eth does not match expected"
        );
      });
    });
  }
});
