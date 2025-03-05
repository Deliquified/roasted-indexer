/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  Roasted,
  Roasted_DataChanged,
  Roasted_OperatorAuthorizationChanged,
  Roasted_OperatorRevoked,
  Roasted_OwnershipTransferred,
  Roasted_RoastPriceSet,
  Roasted_RoastTipped,
  Roasted_TokenIdDataChanged,
  Roasted_Transfer,
  Roasted_UserRoasted,
  Roasted_Withdrawal,
} from "generated";

// Helper function to get or create a User entity
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

// Helper function to get or create a Roast entity
async function getOrCreateRoast(context: any, tokenId: string, roaster: string, roastee: string, amount: bigint) {
  let roast = await context.Roast.get(tokenId);
  if (!roast) {
    const roasterUser = await getOrCreateUser(context, roaster);
    const roasteeUser = await getOrCreateUser(context, roastee);
    roast = {
      id: tokenId,
      roaster: roasterUser,
      roastee: roasteeUser,
      owner: roasterUser, // Initially owned by roaster
      ipfsHash: "", // Will be set via TokenIdDataChanged event
      totalTips: BigInt(0),
      tipCount: 0,
      createdAt: BigInt(Date.now()),
      amount: amount
    };
    await context.Roast.set(roast);
  }
  return roast;
}

Roasted.DataChanged.handler(async ({ event, context }) => {
  const entity: Roasted_DataChanged = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    dataKey: event.params.dataKey,
    dataValue: event.params.dataValue,
  };

  context.Roasted_DataChanged.set(entity);
});

Roasted.OperatorAuthorizationChanged.handler(async ({ event, context }) => {
  const entity: Roasted_OperatorAuthorizationChanged = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    operator: event.params.operator,
    tokenOwner: event.params.tokenOwner,
    tokenId: event.params.tokenId,
    operatorNotificationData: event.params.operatorNotificationData,
  };

  context.Roasted_OperatorAuthorizationChanged.set(entity);
});

Roasted.OperatorRevoked.handler(async ({ event, context }) => {
  const entity: Roasted_OperatorRevoked = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    operator: event.params.operator,
    tokenOwner: event.params.tokenOwner,
    tokenId: event.params.tokenId,
    notified: event.params.notified,
    operatorNotificationData: event.params.operatorNotificationData,
  };

  context.Roasted_OperatorRevoked.set(entity);
});

Roasted.OwnershipTransferred.handler(async ({ event, context }) => {
  const entity: Roasted_OwnershipTransferred = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    previousOwner: event.params.previousOwner,
    newOwner: event.params.newOwner,
  };

  context.Roasted_OwnershipTransferred.set(entity);
});

Roasted.RoastPriceSet.handler(async ({ event, context }) => {
  const entity: Roasted_RoastPriceSet = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    user: event.params.user,
    price: event.params.price,
  };

  // Update user's roast price
  const user = await getOrCreateUser(context, event.params.user);
  user.roastPrice = event.params.price;
  await context.User.set(user);

  context.Roasted_RoastPriceSet.set(entity);
});

Roasted.RoastTipped.handler(async ({ event, context }) => {
  const entity: Roasted_RoastTipped = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    tokenId: event.params.tokenId,
    tipper: event.params.tipper,
    roaster: event.params.roaster,
    amount: event.params.amount,
  };

  // Update roast tips
  const roast = await context.Roast.get(event.params.tokenId);
  if (roast) {
    roast.totalTips = roast.totalTips + event.params.amount;
    roast.tipCount += 1;
    await context.Roast.set(roast);

    // Create tip entity
    const tip = {
      id: `${event.params.tokenId}_${event.params.tipper}_${event.block.timestamp}`,
      roast: roast,
      tipper: await getOrCreateUser(context, event.params.tipper),
      amount: event.params.amount,
      timestamp: BigInt(event.block.timestamp)
    };
    await context.Tip.set(tip);
  }

  context.Roasted_RoastTipped.set(entity);
});

Roasted.TokenIdDataChanged.handler(async ({ event, context }) => {
  const entity: Roasted_TokenIdDataChanged = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    tokenId: event.params.tokenId,
    dataKey: event.params.dataKey,
    dataValue: event.params.dataValue,
  };

  // Update roast metadata
  const metadata = {
    id: `${event.params.tokenId}_${event.params.dataKey}`,
    roast: await context.Roast.get(event.params.tokenId),
    dataKey: event.params.dataKey,
    dataValue: event.params.dataValue
  };
  await context.RoastMetadata.set(metadata);

  context.Roasted_TokenIdDataChanged.set(entity);
});

Roasted.Transfer.handler(async ({ event, context }) => {
  const entity: Roasted_Transfer = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    operator: event.params.operator,
    from: event.params.from,
    to: event.params.to,
    tokenId: event.params.tokenId,
    force: event.params.force,
    data: event.params.data,
  };

  // Update NFT balances
  if (event.params.from !== "0x0000000000000000000000000000000000000000") {
    const fromUser = await getOrCreateUser(context, event.params.from);
    fromUser.nftBalance -= 1;
    await context.User.set(fromUser);
  }

  const toUser = await getOrCreateUser(context, event.params.to);
  toUser.nftBalance += 1;
  await context.User.set(toUser);

  // Update roast ownership
  const roast = await context.Roast.get(event.params.tokenId);
  if (roast) {
    roast.owner = toUser;
    await context.Roast.set(roast);
  }

  context.Roasted_Transfer.set(entity);
});

Roasted.UserRoasted.handler(async ({ event, context }) => {
  const entity: Roasted_UserRoasted = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roaster: event.params.roaster,
    roastee: event.params.roastee,
    amount: event.params.amount,
  };

  // Update user stats
  const roaster = await getOrCreateUser(context, event.params.roaster);
  const roastee = await getOrCreateUser(context, event.params.roastee);

  roaster.timesRoasting += 1;
  roastee.timesRoasted += 1;
  roastee.contractBalance = roastee.contractBalance + event.params.amount;

  await context.User.set(roaster);
  await context.User.set(roastee);

  // Create roast entity
  const tokenId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  await getOrCreateRoast(context, tokenId, event.params.roaster, event.params.roastee, event.params.amount);

  // Update global stats
  let stats = await context.GlobalStats.get("global");
  if (!stats) {
    stats = {
      id: "global",
      totalRoasts: 0,
      totalTips: 0,
      totalVolume: BigInt(0),
      totalWithdrawn: BigInt(0)
    };
  }
  stats.totalRoasts += 1;
  stats.totalVolume = stats.totalVolume + event.params.amount;
  await context.GlobalStats.set(stats);

  context.Roasted_UserRoasted.set(entity);
});

Roasted.Withdrawal.handler(async ({ event, context }) => {
  const entity: Roasted_Withdrawal = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    user: event.params.user,
    amount: event.params.amount,
  };

  // Update user balance
  const user = await getOrCreateUser(context, event.params.user);
  user.contractBalance = user.contractBalance - event.params.amount;
  user.totalWithdrawn = user.totalWithdrawn + event.params.amount;
  await context.User.set(user);

  // Update global stats
  let stats = await context.GlobalStats.get("global");
  if (stats) {
    stats.totalWithdrawn = stats.totalWithdrawn + event.params.amount;
    await context.GlobalStats.set(stats);
  }

  context.Roasted_Withdrawal.set(entity);
});
