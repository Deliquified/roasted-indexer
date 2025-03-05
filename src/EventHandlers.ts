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
  User
} from "generated";

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

  context.Roasted_RoastTipped.set(entity);
});

Roasted.TokenIdDataChanged.handler(async ({ event, context }) => {
  const entity: Roasted_TokenIdDataChanged = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    tokenId: event.params.tokenId,
    dataKey: event.params.dataKey,
    dataValue: event.params.dataValue,
  };

  context.Roasted_TokenIdDataChanged.set(entity);
});

// Helper function to get or create a User entity
async function getOrCreateUser(context: any, address: string): Promise<User> {
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
  }
  return user;
}

// Handle Transfer events to track NFT balances
Roasted.Transfer.handler(async ({ event, context }) => {
  // Create the transfer event entity
  const transferEntity: Roasted_Transfer = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    operator: event.params.operator,
    from: event.params.from,
    to: event.params.to,
    tokenId: event.params.tokenId,
    force: event.params.force,
    data: event.params.data
  };
  
  // Save the transfer event
  context.Roasted_Transfer.set(transferEntity);

  // Update balances for sender (if not minting)
  if (event.params.from !== "0x0000000000000000000000000000000000000000") {
    const fromUser = await getOrCreateUser(context, event.params.from);
    fromUser.nftBalance -= 1;
    context.User.set(fromUser);
  }

  // Update balances for receiver
  const toUser = await getOrCreateUser(context, event.params.to);
  toUser.nftBalance += 1;
  context.User.set(toUser);

  // Update Roast ownership if it exists
  const roast = await context.Roast.get(event.params.tokenId);
  if (roast) {
    roast.owner = toUser;
    context.Roast.set(roast);
  }
});

Roasted.UserRoasted.handler(async ({ event, context }) => {
  const entity: Roasted_UserRoasted = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    roaster: event.params.roaster,
    roastee: event.params.roastee,
    amount: event.params.amount,
  };

  context.Roasted_UserRoasted.set(entity);
});

Roasted.Withdrawal.handler(async ({ event, context }) => {
  const entity: Roasted_Withdrawal = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    user: event.params.user,
    amount: event.params.amount,
  };

  context.Roasted_Withdrawal.set(entity);
});
