/**
 * Setup script to authorize the tournament contract
 * Run with: node scripts/setup-tournament.js
 */

import pkg from "@stacks/transactions";
const { makeContractCall, broadcastTransaction, AnchorMode, contractPrincipalCV } = pkg;

import networkPkg from "@stacks/network";
const { STACKS_TESTNET } = networkPkg;

import dotenv from 'dotenv';
dotenv.config();

// Deployer mnemonic from Testnet.toml
const MNEMONIC = process.env.DEPLOYER_MNEMONIC;

// Contract details
const CONTRACT_ADDRESS = process.env.DEPLOYER_ADDRESS;
const TOURNAMENT_CONTRACT_NAME = "tic_tac_toe_tournament";
const TIC_TAC_TOE_CONTRACT_NAME = "tic_tac_toe";

async function setupTournamentContract() {
  const network = STACKS_TESTNET;

  console.log("🔧 Setting up tournament contract authorization...");
  console.log(`Contract: ${CONTRACT_ADDRESS}.${TIC_TAC_TOE_CONTRACT_NAME}`);

  try {
    // Create the tournament contract principal
    const tournamentContractPrincipal = contractPrincipalCV(
      CONTRACT_ADDRESS,
      TOURNAMENT_CONTRACT_NAME
    );

    // Build the transaction
    const txOptions = {
      contractAddress: CONTRACT_ADDRESS,
      contractName: TIC_TAC_TOE_CONTRACT_NAME,
      functionName: "set-tournament-contract",
      functionArgs: [tournamentContractPrincipal],
      senderKey: await derivePrivateKey(MNEMONIC),
      network: 'testnet',
      anchorMode: AnchorMode.Any,
      fee: 2000n, // 0.002 STX fee
    };

    console.log("📝 Building transaction...");
    const transaction = await makeContractCall(txOptions);

    console.log("📡 Broadcasting transaction...");
    const broadcastResponse = await broadcastTransaction(transaction, 'testnet');

    if (broadcastResponse.error) {
      console.error("❌ Transaction failed:", broadcastResponse);
      throw new Error(broadcastResponse.error);
    }

    console.log("✅ Transaction broadcast successfully!");
    console.log(`📋 Transaction ID: ${broadcastResponse.txid}`);
    console.log(`🔗 View on explorer: https://explorer.hiro.so/txid/${broadcastResponse.txid}?chain=testnet`);
    console.log("\n⏳ Wait for the transaction to confirm (usually 10-30 minutes)");
    console.log("Then you can start creating tournaments!");

  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Derive private key from mnemonic
async function derivePrivateKey(mnemonic) {
  // Use the wallet SDK's derivation
  const { generateWallet, getStxAddress } = await import("@stacks/wallet-sdk");
  
  const wallet = await generateWallet({
    secretKey: mnemonic,
    password: "",
  });
  
  const account = wallet.accounts[0];
  const address = getStxAddress({ account, transactionVersion: 26 }); // 26 = testnet (0x1a)
  
  console.log(`📍 Derived address: ${address}`);

  if (address !== CONTRACT_ADDRESS && address !== process.env.DEPLOYER_ADDRESS_MAINNET) {
    console.warn(`⚠️  Address mismatch! Expected ${CONTRACT_ADDRESS}, got ${address}`);
  }
  
  return account.stxPrivateKey;
}

// Run the setup
setupTournamentContract();
