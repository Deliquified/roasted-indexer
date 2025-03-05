/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import { Roasted } from "generated";

// Constants
const LSP4_METADATA_KEY = "0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TIP_AMOUNT = BigInt("10000000000000000"); // 0.01 ether

// Helper function to get or create a user
async function getOrCreateUser(context: any, address: string) {
  let user = await context.User.get(address);
  if (!user) {
    user = {
      id: address,
      timesRoasted: 0,
      timesRoasting: 0,
      nftBalance: 0,
      contractBalance: BigInt(0),
      totalWithdrawn: BigInt(0),
      roastPrice: BigInt(0)
    };
    await context.User.set(user);
  }
  return user;
}

// Helper function to get or create global stats
async function getOrCreateGlobalStats(context: any) {
  let stats = await context.GlobalStats.get("global");
  if (!stats) {
    stats = {
      id: "global",
      totalRoasts: 0,
      totalTips: 0,
      totalVolume: BigInt(0),
      totalWithdrawn: BigInt(0)
    };
    await context.GlobalStats.set(stats);
  }
  return stats;
}

// Helper function to convert bytes32 to hex string
function bytes32ToHex(bytes32: string): string {
  return bytes32.startsWith('0x') ? bytes32 : '0x' + bytes32;
}

// Handle roast price updates
Roasted.RoastPriceSet.handler(async ({ event, context }) => {
  const user = await getOrCreateUser(context, event.params.user);
  user.roastPrice = BigInt(event.params.price);
  await context.User.set(user);
});

// Handle new roasts
Roasted.UserRoasted.handler(async ({ event, context }) => {
  const roaster = await getOrCreateUser(context, event.params.roaster);
  const roastee = await getOrCreateUser(context, event.params.roastee);
  const stats = await getOrCreateGlobalStats(context);
  
  // Update roaster stats
  roaster.timesRoasting += 1;
  roaster.nftBalance += 1;
  
  // Update roastee stats
  roastee.timesRoasted += 1;
  roastee.contractBalance += BigInt(event.params.amount) / BigInt(2); // 50% split
  
  // Create new roast
  const roast = {
    id: event.params.tokenId.toString(),
    roaster: roaster.id,
    roastee: roastee.id,
    owner: roaster.id,
    ipfsHash: "",
    totalTips: BigInt(0),
    tipCount: 0,
    createdAt: BigInt(event.block.timestamp),
    amount: BigInt(event.params.amount)
  };
  
  // Update global stats
  stats.totalRoasts += 1;
  stats.totalVolume += BigInt(event.params.amount);
  
  // Save all updates
  await context.User.set(roaster);
  await context.User.set(roastee);
  await context.Roast.set(roast);
  await context.GlobalStats.set(stats);
});

// Handle NFT transfers
Roasted.Transfer.handler(async ({ event, context }) => {
  const from = await getOrCreateUser(context, event.params.from);
  const to = await getOrCreateUser(context, event.params.to);
  
  // Update NFT balances
  if (from.id !== ZERO_ADDRESS) {
    from.nftBalance -= 1;
    await context.User.set(from);
  }
  
  to.nftBalance += 1;
  await context.User.set(to);
  
  // Update roast ownership
  const roast = await context.Roast.get(event.params.tokenId.toString());
  if (roast) {
    roast.owner = to.id;
    await context.Roast.set(roast);
  }
});

// Handle metadata updates
Roasted.TokenIdDataChanged.handler(async ({ event, context }) => {
  const tokenId = event.params.tokenId.toString();
  const dataKey = bytes32ToHex(event.params.dataKey);

  // Only process LSP4 metadata updates
  if (dataKey === LSP4_METADATA_KEY) {
    // Get or create the roast
    let roast = await context.Roast.get(tokenId);
    if (roast) {
      // Update IPFS hash
      roast.ipfsHash = event.params.dataValue;
      await context.Roast.set(roast);
    }
  }
});

// Handle tips with more detailed tracking
Roasted.RoastTipped.handler(async ({ event, context }) => {
  const tokenId = event.params.tokenId.toString();
  const roast = await context.Roast.get(tokenId);
  const roaster = await getOrCreateUser(context, event.params.roaster);
  const tipper = await getOrCreateUser(context, event.params.tipper);
  const stats = await getOrCreateGlobalStats(context);
  
  if (roast) {
    // Create new tip record
    const tipId = `${tokenId}-${event.params.tipper}-${event.block.timestamp}`;
    const tip = {
      id: tipId,
      roast: tokenId,
      tipper: tipper.id,
      amount: TIP_AMOUNT,
      timestamp: BigInt(event.block.timestamp)
    };
    await context.Tip.set(tip);

    // Update roast stats
    roast.totalTips += TIP_AMOUNT;
    roast.tipCount += 1;
    
    // Update roaster's balance (70% of tip)
    roaster.contractBalance += (TIP_AMOUNT * BigInt(70)) / BigInt(100);
    
    // Update global stats
    stats.totalTips += 1;
    stats.totalVolume += TIP_AMOUNT;
    
    await context.Roast.set(roast);
    await context.User.set(roaster);
    await context.GlobalStats.set(stats);
  }
});

// Handle withdrawals
Roasted.Withdrawal.handler(async ({ event, context }) => {
  const user = await getOrCreateUser(context, event.params.user);
  const stats = await getOrCreateGlobalStats(context);
  
  user.contractBalance -= BigInt(event.params.amount);
  user.totalWithdrawn += BigInt(event.params.amount);
  stats.totalWithdrawn += BigInt(event.params.amount);
  
  await context.User.set(user);
  await context.GlobalStats.set(stats);
});
