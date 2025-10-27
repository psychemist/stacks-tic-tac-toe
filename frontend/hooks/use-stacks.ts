import { createNewGame, joinGame, Move, play } from "@/lib/contract";
import { getStxBalance } from "@/lib/stx-utils";
import {
  AppConfig,
  connect,
  disconnect,
  isConnected,
  getLocalStorage,
  openContractCall,
  type UserData,
  UserSession,
} from "@stacks/connect";
import { STACKS_TESTNET } from "@stacks/network";
import { PostConditionMode } from "@stacks/transactions";
import { useEffect, useState } from "react";

const appDetails = {
  name: "Tic Tac Toe",
  icon: "https://cryptologos.cc/logos/stacks-stx-logo.png",
};

const appConfig = new AppConfig(["store_write", "publish_data"]);
const userSession = new UserSession({ appConfig });

export function useStacks() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [stxBalance, setStxBalance] = useState(0);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  async function connectWallet() {
    try {
      await connect();
      
      // Get user address after connection; prioritize testnet
      let address = null;
      if (isConnected()) {
        const data = getLocalStorage();
        if (data?.addresses?.stx && data.addresses.stx.length > 0) {
          type StxAddress = { address: string; network?: string };
          const testnetAddr = data.addresses.stx.find((addr: StxAddress) => 
            addr.network === 'testnet' || addr.address.startsWith('ST')
          );
          address = testnetAddr?.address || data.addresses.stx[0].address;
          setUserAddress(address);
        }
      } else if (userSession.isUserSignedIn()) {
        const userData = userSession.loadUserData();
        address = userData.profile.stxAddress.testnet;
        setUserAddress(address);
        setUserData(userData);
      }
      
      // Reload to update state
      window.location.reload();
    } catch (error) {
      console.error("Connection failed:", error);
      window.alert("Failed to connect wallet. Please try again.");
    }
  }

  function disconnectWallet() {
    disconnect();
    userSession.signUserOut("/");
    setUserData(null);
    setUserAddress(null);
  }

  async function handleCreateGame(
    betAmount: number,
    moveIndex: number,
    move: Move
  ) {
    if (typeof window === "undefined") return;
    if (moveIndex < 0 || moveIndex > 8) {
      window.alert("Invalid move. Please make a valid move.");
      return;
    }
    if (betAmount === 0) {
      window.alert("Please make a bet");
      return;
    }

    try {
      if (!userData && !userAddress) throw new Error("User not connected");
      const txOptions = await createNewGame(betAmount, moveIndex, move);
      await openContractCall({
        ...txOptions,
        appDetails,
        network: STACKS_TESTNET,
        onFinish: (data) => {
          console.log(data);
          window.alert("Sent create game transaction");
        },
        postConditionMode: PostConditionMode.Allow,
      });
    } catch (_err) {
      const err = _err as Error;
      console.error(err);
      window.alert(err.message);
    }
  }

  async function handleJoinGame(gameId: number, moveIndex: number, move: Move) {
    if (typeof window === "undefined") return;
    if (moveIndex < 0 || moveIndex > 8) {
      window.alert("Invalid move. Please make a valid move.");
      return;
    }

    try {
      if (!userData && !userAddress) throw new Error("User not connected");
      const txOptions = await joinGame(gameId, moveIndex, move);
      await openContractCall({
        ...txOptions,
        appDetails,
        network: STACKS_TESTNET,
        onFinish: (data) => {
          console.log(data);
          window.alert("Sent join game transaction");
        },
        postConditionMode: PostConditionMode.Allow,
      });
    } catch (_err) {
      const err = _err as Error;
      console.error(err);
      window.alert(err.message);
    }
  }

  async function handlePlayGame(gameId: number, moveIndex: number, move: Move) {
    if (typeof window === "undefined") return;
    if (moveIndex < 0 || moveIndex > 8) {
      window.alert("Invalid move. Please make a valid move.");
      return;
    }

    try {
      if (!userData && !userAddress) throw new Error("User not connected");
      const txOptions = await play(gameId, moveIndex, move);
      await openContractCall({
        ...txOptions,
        appDetails,
        network: STACKS_TESTNET,
        onFinish: (data) => {
          console.log(data);
          window.alert("Sent play game transaction");
        },
        postConditionMode: PostConditionMode.Allow,
      });
    } catch (_err) {
      const err = _err as Error;
      console.error(err);
      window.alert(err.message);
    }
  }

  useEffect(() => {
    // Check if user is connected via new connect method
    if (isConnected()) {
      const data = getLocalStorage();
      if (data?.addresses?.stx && data.addresses.stx.length > 0) {
        // Check if there's a testnet address in the array
        type StxAddress = { address: string; network?: string };
        const testnetAddr = data.addresses.stx.find((addr: StxAddress) => 
          addr.network === 'testnet' || addr.address.startsWith('ST')
        );
        const mainnetAddr = data.addresses.stx.find((addr: StxAddress) => 
          addr.network === 'mainnet' || addr.address.startsWith('SP')
        );
        
        // Use testnet address for our testnet app
        const address = testnetAddr?.address || data.addresses.stx[0].address;
        setUserAddress(address);

        // Create minimal userData for compatibility
        setUserData({
          profile: {
            stxAddress: {
              testnet: testnetAddr?.address || address,
              mainnet: mainnetAddr?.address || address,
            },
          },
        } as UserData);
      }
    } else if (userSession.isSignInPending()) {
      userSession.handlePendingSignIn().then((userData) => {
        setUserData(userData);
        setUserAddress(userData.profile.stxAddress.testnet);
      });
    } else if (userSession.isUserSignedIn()) {
      const userData = userSession.loadUserData();
      setUserData(userData);
      setUserAddress(userData.profile.stxAddress.testnet);
    }
  }, []);

  useEffect(() => {
    if (userAddress) {
      getStxBalance(userAddress).then((balance) => {
        setStxBalance(balance);
      });
    }
  }, [userAddress]);

  useEffect(() => {
    // Check connection status only on client side
    if (typeof window !== 'undefined') {
      setConnected(isConnected() || userSession.isUserSignedIn());
    }
  }, [userData]);

  return {
    userData,
    userAddress,
    stxBalance,
    connectWallet,
    disconnectWallet,
    handleCreateGame,
    handleJoinGame,
    handlePlayGame,
    isConnected: connected,
  };
}