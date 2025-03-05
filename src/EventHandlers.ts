/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import { Roasted } from "generated";

// Types for our event handlers
type EventContext = {
  User: {
    get: (id: string) => Promise<any>;
    set: (entity: any) => Promise<void>;
  };
  Roast: {
    get: (id: string) => Promise<any>;
    set: (entity: any) => Promise<void>;
  };
  RoastMetadata: {
    get: (id: string) => Promise<any>;
    set: (entity: any) => Promise<void>;
  };
  GlobalStats: {
    get: (id: string) => Promise<any>;
    set: (entity: any) => Promise<void>;
  };
};

type EventType = {
  chainId: string;
  block: {
    number: number;
    timestamp: number;
  };
  logIndex: number;
  params: any;
};

// Helper function to get or create a user
async function getOrCreateUser(context: EventContext, address: string) {
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
async function getOrCreateGlobalStats(context: EventContext) {
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
Roasted.RoastPriceSet.handler(async ({ event, context }: { event: EventType; context: EventContext }) => {
  const user = await getOrCreateUser(context, event.params.user);
  user.roastPrice = BigInt(event.params.price);
  await context.User.set(user);
});

// Handle new roasts
Roasted.UserRoasted.handler(async ({ event, context }: { event: EventType; context: EventContext }) => {
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
Roasted.Transfer.handler(async ({ event, context }: { event: EventType; context: EventContext }) => {
  const from = await getOrCreateUser(context, event.params.from);
  const to = await getOrCreateUser(context, event.params.to);
  
  // Update NFT balances
  if (from.id !== "0x0000000000000000000000000000000000000000") {
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
Roasted.TokenIdDataChanged.handler(async ({ event, context }: { event: EventType; context: EventContext }) => {
  const tokenId = event.params.tokenId.toString();
  const dataKey = bytes32ToHex(event.params.dataKey);
  const dataValue = event.params.dataValue;

  // Create unique ID for metadata entry
  const metadataId = `${tokenId}-${dataKey}`;

  // Get or create the roast
  let roast = await context.Roast.get(tokenId);
  if (!roast) {
    // If roast doesn't exist yet (metadata set before mint), create a placeholder
    roast = {
      id: tokenId,
      roaster: "0x0000000000000000000000000000000000000000", // Will be set during mint
      roastee: "0x0000000000000000000000000000000000000000", // Will be set during mint
      owner: "0x0000000000000000000000000000000000000000", // Will be set during mint
      totalTips: BigInt(0),
      tipCount: 0,
      createdAt: BigInt(event.block.timestamp),
      amount: BigInt(0)
    };
    await context.Roast.set(roast);
  }

  // Create or update metadata entry
  const metadata = {
    id: metadataId,
    roast: tokenId,
    dataKey: dataKey,
    dataValue: dataValue
  };
  await context.RoastMetadata.set(metadata);
});

// Handle tips
Roasted.RoastTipped.handler(async ({ event, context }: { event: EventType; context: EventContext }) => {
  const roast = await context.Roast.get(event.params.tokenId.toString());
  const roaster = await getOrCreateUser(context, event.params.roaster);
  const stats = await getOrCreateGlobalStats(context);
  
  if (roast) {
    roast.totalTips += BigInt(event.params.amount);
    roast.tipCount += 1;
    
    // Update roaster's balance (70% of tip)
    roaster.contractBalance += (BigInt(event.params.amount) * BigInt(70)) / BigInt(100);
    
    // Update global stats
    stats.totalTips += 1;
    stats.totalVolume += BigInt(event.params.amount);
    
    await context.Roast.set(roast);
    await context.User.set(roaster);
    await context.GlobalStats.set(stats);
  }
});

// Handle withdrawals
Roasted.Withdrawal.handler(async ({ event, context }: { event: EventType; context: EventContext }) => {
  const user = await getOrCreateUser(context, event.params.user);
  const stats = await getOrCreateGlobalStats(context);
  
  user.contractBalance -= BigInt(event.params.amount);
  user.totalWithdrawn += BigInt(event.params.amount);
  stats.totalWithdrawn += BigInt(event.params.amount);
  
  await context.User.set(user);
  await context.GlobalStats.set(stats);
});
