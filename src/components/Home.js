import { ethers } from "ethers";
import { useEffect, useState, useCallback } from "react";
import PropTypes from "prop-types";

import close from "../assets/close.svg";

const Home = ({ home, provider, account, escrow, togglePop }) => {
  const [state, setState] = useState({
    hasBought: false,
    hasLended: false,
    hasInspected: false,
    hasSold: false,
    buyer: null,
    lender: null,
    inspector: null,
    seller: null,
    owner: null,
  });

  const getSigner = useCallback(async () => {
    try {
      return await provider.getSigner();
    } catch (error) {
      console.error("Failed to get signer:", error);
      throw error;
    }
  }, [provider]);

  const fetchDetails = useCallback(async () => {
    try {
      const buyer = await escrow.buyer(home.id);
      const seller = await escrow.seller();
      const lender = await escrow.lender();
      const inspector = await escrow.inspector();

      const [hasBought, hasSold, hasLended, hasInspected] = await Promise.all([
        escrow.approval(home.id, buyer),
        escrow.approval(home.id, seller),
        escrow.approval(home.id, lender),
        escrow.inspectionPassed(home.id),
      ]);

      setState((prevState) => ({
        ...prevState,
        buyer,
        seller,
        lender,
        inspector,
        hasBought,
        hasSold,
        hasLended,
        hasInspected,
      }));
    } catch (error) {
      console.error("Error fetching details:", error);
    }
  }, [escrow, home.id]);

  const fetchOwner = useCallback(async () => {
    try {
      if (await escrow.isListed(home.id)) return;
      const owner = await escrow.buyer(home.id);
      setState((prevState) => ({ ...prevState, owner }));
    } catch (error) {
      console.error("Error fetching owner:", error);
    }
  }, [escrow, home.id]);

  const handleTransaction = async (transactionFunction) => {
    try {
      const signer = await getSigner();
      const transaction = await transactionFunction(signer);
      await transaction.wait();
      await fetchDetails();
    } catch (error) {
      console.error("Transaction failed:", error);
    }
  };

  const [error, setError] = useState(null);
  const buyHandler = async () => {
    setError(null);
    if (!account) {
      setError("Please connect your wallet to make a purchase.");
      return;
    }
    try {
      const signer = await provider.getSigner();
      const escrowAmount = await escrow.escrowAmount(home.id);

      let buyer;
      try {
        buyer = await escrow.buyer(home.id);
      } catch (error) {
        console.error("Error fetching buyer:", error);
        setError("Error fetching property details. Please try again.");
        return;
      }

      if (buyer && buyer !== ethers.ZeroAddress) {
        if (buyer.toLowerCase() !== account.toLowerCase()) {
          setError("Only the designated buyer can purchase this property.");
          return;
        }
      }

      // If buyer is not set (ZeroAddress), anyone can buy
      if (buyer === ethers.ZeroAddress) {
        // If your contract has a setBuyer function, uncomment the next line
        // await escrow.connect(signer).setBuyer(home.id, account);
      }

      let transaction = await escrow
        .connect(signer)
        .depositEarnest(home.id, { value: escrowAmount });
      await transaction.wait();

      transaction = await escrow.connect(signer).approveSale(home.id);
      await transaction.wait();

      setState((prevState) => ({ ...prevState, hasBought: true }));
      await fetchDetails();
    } catch (error) {
      console.error("Transaction failed:", error);
      setError(error.reason || "Transaction failed. Please try again.");
    }
  };

  const inspectHandler = () =>
    handleTransaction(async (signer) =>
      escrow.connect(signer).updateInspectionStatus(home.id, true)
    );

  const lendHandler = () =>
    handleTransaction(async (signer) => {
      await escrow.connect(signer).approveSale(home.id);
      const lendAmount =
        (await escrow.purchasePrice(home.id)) -
        (await escrow.escrowAmount(home.id));
      return signer.sendTransaction({
        to: await escrow.getAddress(),
        value: lendAmount.toString(),
      });
    });

  const sellHandler = () =>
    handleTransaction(async (signer) => {
      await escrow.connect(signer).approveSale(home.id);
      return escrow.connect(signer).finalizeSale(home.id);
    });

  useEffect(() => {
    fetchDetails();
    fetchOwner();
  }, [fetchDetails, fetchOwner]);

  const {
    hasBought,
    hasLended,
    hasInspected,
    hasSold,
    buyer,
    lender,
    inspector,
    seller,
    owner,
  } = state;

  return (
    <div className="home">
      <div className="home__details">
        <div className="home__image">
          <img src={home.image} alt={`${home.name} property`} />
        </div>
        <div className="home__overview">
          <h1>{home.name}</h1>
          <p>
            <strong>{home.attributes[2].value}</strong> bds |
            <strong>{home.attributes[3].value}</strong> ba |
            <strong>{home.attributes[4].value}</strong> sqft
          </p>
          <p>{home.address}</p>
          <h2>{home.attributes[0].value} ETH</h2>

          {error && <div className="error-message">{error}</div>}

          {owner ? (
            <div className="home__owned">
              Owned by {ethers.getAddress(owner).substring(0, 6)}...
              {ethers.getAddress(owner).substring(38)}
            </div>
          ) : (
            <div>
              {account === inspector && (
                <button
                  className="home__buy"
                  onClick={inspectHandler}
                  disabled={hasInspected}
                >
                  {hasInspected ? "Inspection Approved" : "Approve Inspection"}
                </button>
              )}
              {account === lender && (
                <button
                  className="home__buy"
                  onClick={lendHandler}
                  disabled={hasLended}
                >
                  {hasLended ? "Loan Approved" : "Approve & Lend"}
                </button>
              )}
              {account === seller && (
                <button
                  className="home__buy"
                  onClick={sellHandler}
                  disabled={hasSold}
                >
                  {hasSold ? "Sold" : "Approve & Sell"}
                </button>
              )}
              {account !== inspector &&
                account !== lender &&
                account !== seller && (
                  <button
                    className="home__buy"
                    onClick={buyHandler}
                    disabled={hasBought}
                  >
                    {hasBought ? "Purchased" : "Buy"}
                  </button>
                )}
              <button className="home__contact">Contact agent</button>
            </div>
          )}
          <hr />
          <h2>Overview</h2>
          <p>{home.description}</p>
          <hr />
          <h2>Facts and features</h2>
          <ul>
            {home.attributes.map((attribute, index) => (
              <li key={index}>
                <strong>{attribute.trait_type}</strong>: {attribute.value}
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={togglePop}
          className="home__close"
          aria-label="Close property details"
        >
          <img src={close} alt="Close icon" />
        </button>
      </div>
    </div>
  );
};

Home.propTypes = {
  home: PropTypes.object.isRequired,
  provider: PropTypes.object.isRequired,
  account: PropTypes.string.isRequired,
  escrow: PropTypes.object.isRequired,
  togglePop: PropTypes.func.isRequired,
};

export default Home;
