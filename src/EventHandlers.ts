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

// Helper function to load or create a User entity
async function getOrCreateUser(address: string, context: any) {
  let user = await context.User.get(address);
  if (!user) {
    user = {
      id: address,
      currentBalance: BigInt(0),
      totalWithdrawn: BigInt(0),
      lastUpdatedBlock: 0,
      lastUpdatedTimestamp: 0,
    };
    await context.User.set(user);
  }
  return user;
}

// Helper function to load or create a RoastedToken entity
async function getOrCreateToken(tokenId: string, owner: string, context: any) {
  let token = await context.RoastedToken.get(tokenId);
  if (!token) {
    token = {
      id: tokenId,
      totalTipsReceived: BigInt(0),
      owner: owner,
      lastUpdatedBlock: 0,
      lastUpdatedTimestamp: 0,
    };
    await context.RoastedToken.set(token);
  }
  return token;
}

Roasted.DataChanged.handler(async ({ event, context }) => {
  let entity: Roasted_DataChanged = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    dataKey: event.params.dataKey,
    dataValue: event.params.dataValue,
  };

  context.Roasted_DataChanged.set(entity);
});

Roasted.OperatorAuthorizationChanged.handler(async ({ event, context }) => {
  let entity: Roasted_OperatorAuthorizationChanged = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    operator: event.params.operator,
    tokenOwner: event.params.tokenOwner,
    tokenId: event.params.tokenId,
    operatorNotificationData: event.params.operatorNotificationData,
  };

  context.Roasted_OperatorAuthorizationChanged.set(entity);
});

Roasted.OperatorRevoked.handler(async ({ event, context }) => {
  let entity: Roasted_OperatorRevoked = {
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
  let entity: Roasted_OwnershipTransferred = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    previousOwner: event.params.previousOwner,
    newOwner: event.params.newOwner,
  };

  context.Roasted_OwnershipTransferred.set(entity);
});

Roasted.RoastPriceSet.handler(async ({ event, context }) => {
  let entity: Roasted_RoastPriceSet = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    user: event.params.user,
    price: event.params.price,
  };

  context.Roasted_RoastPriceSet.set(entity);
});

Roasted.RoastTipped.handler(async ({ event, context }) => {
  let roaster = await getOrCreateUser(event.params.roaster, context);
  let token = await getOrCreateToken(event.params.tokenId.toString(), event.params.roaster, context);
  let roast = await context.Roast.get(event.params.tokenId.toString());

  if (!roast) {
    console.log(`Warning: Roast ${event.params.tokenId.toString()} not found for tip`);
    return;
  }

  // Update roaster's contract balance from the tip
  roaster.currentBalance = roaster.currentBalance + event.params.amount;
  roaster.lastUpdatedBlock = event.block.number;
  roaster.lastUpdatedTimestamp = event.block.timestamp;

  // Update token's tip stats
  token.totalTipsReceived = token.totalTipsReceived + event.params.amount;
  token.lastUpdatedBlock = event.block.number;
  token.lastUpdatedTimestamp = event.block.timestamp;

  // Update roast's tip stats
  roast.totalTips = roast.totalTips + event.params.amount;
  roast.tipCount = roast.tipCount + 1;

  await context.User.set(roaster);
  await context.RoastedToken.set(token);
  await context.Roast.set(roast);

  // Store the tip event
  let tip = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    token: event.params.tokenId.toString(),
    tipper: event.params.tipper,
    roaster: event.params.roaster,
    amount: event.params.amount,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
    roast: event.params.tokenId.toString(),
  };

  await context.Tip.set(tip);

  // Store the event entity
  let entity: Roasted_RoastTipped = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    tokenId: event.params.tokenId,
    tipper: event.params.tipper,
    roaster: event.params.roaster,
    amount: event.params.amount,
  };

  context.Roasted_RoastTipped.set(entity);
});

Roasted.TokenIdDataChanged.handler(async ({ event, context }) => {
  let entity: Roasted_TokenIdDataChanged = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    tokenId: event.params.tokenId,
    dataKey: event.params.dataKey,
    dataValue: event.params.dataValue,
  };

  context.Roasted_TokenIdDataChanged.set(entity);
});

Roasted.Transfer.handler(async ({ event, context }) => {
  let token = await getOrCreateToken(event.params.tokenId.toString(), event.params.to, context);
  
  // Update token ownership
  token.owner = event.params.to;
  token.lastUpdatedBlock = event.block.number;
  token.lastUpdatedTimestamp = event.block.timestamp;

  await context.RoastedToken.set(token);

  let entity: Roasted_Transfer = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    operator: event.params.operator,
    from: event.params.from,
    to: event.params.to,
    tokenId: event.params.tokenId,
    force: event.params.force,
    data: event.params.data,
  };

  context.Roasted_Transfer.set(entity);
});

Roasted.UserRoasted.handler(async ({ event, context }) => {
  let roaster = await getOrCreateUser(event.params.roaster, context);

  // Update roaster's contract balance from the roast payment
  roaster.currentBalance = roaster.currentBalance + event.params.amount;
  roaster.lastUpdatedBlock = event.block.number;
  roaster.lastUpdatedTimestamp = event.block.timestamp;

  await context.User.set(roaster);

  // Store the roast event
  let entity: Roasted_UserRoasted = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roaster: event.params.roaster,
    roastee: event.params.roastee,
    amount: event.params.amount,
  };

  context.Roasted_UserRoasted.set(entity);
});

Roasted.Withdrawal.handler(async ({ event, context }) => {
  let user = await getOrCreateUser(event.params.user, context);

  // Update user's contract balance and total withdrawn
  user.currentBalance = user.currentBalance - event.params.amount;
  user.totalWithdrawn = user.totalWithdrawn + event.params.amount;
  user.lastUpdatedBlock = event.block.number;
  user.lastUpdatedTimestamp = event.block.timestamp;

  await context.User.set(user);

  // Store the withdrawal event
  let withdrawal = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    user: event.params.user,
    amount: event.params.amount,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
    transactionHash: event.transaction.hash,
  };

  await context.Withdrawal.set(withdrawal);

  // Store the event entity
  let entity: Roasted_Withdrawal = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    user: event.params.user,
    amount: event.params.amount,
  };

  context.Roasted_Withdrawal.set(entity);
});
