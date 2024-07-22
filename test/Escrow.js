const { expect } = require("chai");
const { ethers } = require("hardhat");

const tokens = (n) => {
  return ethers.parseUnits(n.toString(), "ether");
};

describe("Escrow", () => {
  let buyer, seller, inspector, lender;
  let realEstate, escrow;

  beforeEach(async () => {
    // Septup accounts
    [buyer, seller, inspector, lender] = await ethers.getSigners();

    // Delop Real Estate
    const RealEstate = await ethers.getContractFactory("RealEstate");
    realEstate = await RealEstate.deploy();

    // Mint
    let transaction = await realEstate
      .connect(seller)
      .mint(
        "https://ipfs.io/ipfs/QmTudSYeM7mz3PkYEWXWqPjomRPHogcMFSq7XAvsvsgAPS"
      );
    await transaction.wait();

    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(
      realEstate.getAddress(),
      seller.getAddress(),
      inspector.getAddress(),
      lender.getAddress()
    );

    // Approve property
    transaction = await realEstate
      .connect(seller)
      .approve(escrow.getAddress(), 1);
    await transaction.wait;

    // List property

    transaction = await escrow
      .connect(seller)
      .list(1, buyer.getAddress(), tokens(10), tokens(5));
    await transaction.wait;
  });

  describe("Development", () => {
    it("Return NFT address", async () => {
      const result = await escrow.nftAddress();
      const address = await realEstate.getAddress();
      expect(result).to.be.equal(address);
    });

    it("Return seller", async () => {
      const result = await escrow.seller();
      const address = await seller.getAddress();
      expect(result).to.be.equal(address);
    });

    it("Return inspector", async () => {
      const result = await escrow.inspector();
      const address = await inspector.getAddress();
      expect(result).to.be.equal(address);
    });

    it("Return lender", async () => {
      const result = await escrow.lender();
      const address = await lender.getAddress();
      expect(result).to.be.equal(address);
    });
  });

  describe("Listing", () => {
    it("Updates as listed", async () => {
      const result = await escrow.isListed(1);
      expect(result).to.be.equal(true);
    });

    it("Update owership", async () => {
      const address = await escrow.getAddress();
      expect(await realEstate.ownerOf(1)).to.be.equal(address);
    });

    it("Returns buyer", async () => {
      const result = await escrow.buyer(1);
      expect(result).to.be.equal(buyer.address);
    });

    it("Returns purchase price", async () => {
      const result = await escrow.purchasePrice(1);
      expect(result).to.be.equal(tokens(10));
    });

    it("Returns escrow amount", async () => {
      const result = await escrow.escrowAmount(1);
      expect(result).to.be.equal(tokens(5));
    });
  });

  describe("Desposits", () => {
    it("Updates contract balance", async () => {
      const transaction = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) });
      await transaction.wait();
      const result = await escrow.getBalance();
      expect(result).to.be.equal(tokens(5));
    });

    // it("Updates contract balance", async () => {
    //   const result = await escrow.getBalance();
    //   expect(result).to.be.equal(tokens(5));
    // });
  });

  describe("Inspection", () => {
    beforeEach(async () => {
      const transaction = await escrow
        .connect(inspector)
        .updateInspectionStatus(1, true);
      await transaction.wait();
    });

    it("Updates inspection status", async () => {
      const result = await escrow.inspectionPassed(1);
      expect(result).to.be.equal(true);
    });
  });

  describe("Approval", () => {
    beforeEach(async () => {
      let transaction = await escrow.connect(buyer).approveSale(1);
      await transaction.wait();

      transaction = await escrow.connect(seller).approveSale(1);
      await transaction.wait();

      transaction = await escrow.connect(lender).approveSale(1);
      await transaction.wait();
    });

    it("Updates approval status", async () => {
      const add1 = await buyer.getAddress();
      const add2 = await seller.getAddress();
      const add3 = await lender.getAddress();
      expect(await escrow.approval(1, add1)).to.be.equal(true);
      expect(await escrow.approval(1, add2)).to.be.equal(true);
      expect(await escrow.approval(1, add3)).to.be.equal(true);
    });
  });

  describe("Sale", () => {
    beforeEach(async () => {
      let transaction = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(5) });
      await transaction.wait();

      transaction = await escrow
        .connect(inspector)
        .updateInspectionStatus(1, true);
      await transaction.wait();

      transaction = await escrow.connect(buyer).approveSale(1);
      await transaction.wait();

      transaction = await escrow.connect(seller).approveSale(1);
      await transaction.wait();

      transaction = await escrow.connect(lender).approveSale(1);
      await transaction.wait();

      const add1 = await escrow.getAddress();

      await lender.sendTransaction({ to: add1, value: tokens(5) });

      transaction = await escrow.connect(seller).finalizeSale(1);
      await transaction.wait();
    });

    it("Updates ownership", async () => {
      const add2 = await buyer.getAddress();
      expect(await realEstate.ownerOf(1)).to.be.equal(add2);
    });

    it("Updates balance", async () => {
      expect(await escrow.getBalance()).to.be.equal(0);
    });
  });
});
