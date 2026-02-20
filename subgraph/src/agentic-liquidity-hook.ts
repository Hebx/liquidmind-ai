import { BigInt } from "@graphprotocol/graph-ts";
import {
  AgentActionExecuted as AgentActionExecutedEvent,
  CrossChainSignalReceived as CrossChainSignalReceivedEvent,
  FeeUpdated as FeeUpdatedEvent,
  LiquidityRebalanced as LiquidityRebalancedEvent,
} from "../generated/AgenticLiquidityHook/AgenticLiquidityHook";
import {
  AgentActionExecuted,
  CrossChainSignalReceived,
  FeeUpdated,
  LiquidityRebalanced,
} from "../generated/schema";

export function handleAgentActionExecuted(event: AgentActionExecutedEvent): void {
  let entity = new AgentActionExecuted(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  entity.actionId = event.params.actionId;
  entity.actionType = event.params.actionType;
  entity.timestamp = event.params.timestamp;
  entity.blockNumber = event.block.number;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleCrossChainSignalReceived(
  event: CrossChainSignalReceivedEvent
): void {
  let entity = new CrossChainSignalReceived(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  entity.sourceChainId = event.params.sourceChainId;
  entity.signalId = event.params.signalId;
  entity.data = event.params.data;
  entity.blockNumber = event.block.number;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleFeeUpdated(event: FeeUpdatedEvent): void {
  let entity = new FeeUpdated(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  entity.poolId = event.params.poolId;
  entity.newFee = BigInt.fromI32(event.params.newFee);
  entity.blockNumber = event.block.number;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleLiquidityRebalanced(event: LiquidityRebalancedEvent): void {
  let entity = new LiquidityRebalanced(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  entity.poolId = event.params.poolId;
  entity.newTickLower = BigInt.fromI32(event.params.newTickLower);
  entity.newTickUpper = BigInt.fromI32(event.params.newTickUpper);
  entity.blockNumber = event.block.number;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}
