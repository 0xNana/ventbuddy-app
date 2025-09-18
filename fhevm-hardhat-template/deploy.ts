const { ethers } = require("hardhat");
import { Ventbuddy, Ventbuddy__factory } from "./types";

async function main() {
  console.log("Starting Ventbuddy contract deployment...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deployment parameters
  const feeRecipient = deployer.address; // Use deployer as fee recipient for now
  const feeBasisPoints = 500; // 5% fee (500 basis points)

  console.log("Deployment parameters:");
  console.log("- Fee Recipient:", feeRecipient);
  console.log("- Fee Basis Points:", feeBasisPoints);
  console.log("- Currency: Native ETH");

  // Deploy the contract
  const VentbuddyFactory = (await ethers.getContractFactory("Ventbuddy")) as Ventbuddy__factory;
  
  console.log("Deploying Ventbuddy contract...");
  const ventbuddy = await VentbuddyFactory.deploy(
    feeRecipient,
    feeBasisPoints
  );

  await ventbuddy.waitForDeployment();
  const contractAddress = await ventbuddy.getAddress();

  console.log("✅ Ventbuddy contract deployed successfully!");
  console.log("Contract address:", contractAddress);
  console.log("Deployment transaction:", ventbuddy.deploymentTransaction()?.hash);

  // Verify deployment by calling some view functions
  console.log("\nVerifying deployment...");
  try {
    const deployedFeeRecipient = await ventbuddy.feeRecipient();
    const deployedFeeBasisPoints = await ventbuddy.feeBasisPoints();
    const owner = await ventbuddy.owner();
    
    console.log("✅ Contract verification successful:");
    console.log("- Owner:", owner);
    console.log("- Fee Recipient:", deployedFeeRecipient);
    console.log("- Fee Basis Points:", deployedFeeBasisPoints.toString());
    console.log("- Currency: Native ETH");
  } catch (error) {
    console.error("❌ Contract verification failed:", error);
  }

  // Save deployment info
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    contractAddress: contractAddress,
    deployer: deployer.address,
    deploymentTx: ventbuddy.deploymentTransaction()?.hash,
    feeRecipient: feeRecipient,
    feeBasisPoints: feeBasisPoints,
    currency: "Native ETH",
    timestamp: new Date().toISOString()
  };

  console.log("\n📋 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  return contractAddress;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then((address) => {
    console.log(`\n🎉 Deployment completed successfully!`);
    console.log(`Contract deployed at: ${address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
