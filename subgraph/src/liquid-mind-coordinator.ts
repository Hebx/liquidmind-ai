import {
  AgentRegistered as AgentRegisteredEvent,
  HookRegistered as HookRegisteredEvent,
  LiquidityCommandSent as LiquidityCommandSentEvent,
  MessageReceived as MessageReceivedEvent,
  MessageSent as MessageSentEvent,
} from "../generated/LiquidMindCoordinator/LiquidMindCoordinator";
import {
  AgentRegistered,
  HookRegistered,
  LiquidityCommandSent,
  MessageReceived,
  MessageSent,
} from "../generated/schema";

export function handleAgentRegistered(event: AgentRegisteredEvent): void {
  let entity = new AgentRegistered(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  entity.agent = event.params.agent;
  entity.authorized = event.params.authorized;
  entity.blockNumber = event.block.number;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleHookRegistered(event: HookRegisteredEvent): void {
  let entity = new HookRegistered(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  entity.chainId = event.params.chainId;
  entity.hook = event.params.hook;
  entity.blockNumber = event.block.number;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleLiquidityCommandSent(
  event: LiquidityCommandSentEvent
): void {
  let entity = new LiquidityCommandSent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  entity.targetChainId = event.params.targetChainId;
  entity.commandId = event.params.commandId;
  entity.commandType = event.params.commandType;
  entity.blockNumber = event.block.number;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleMessageReceived(event: MessageReceivedEvent): void {
  let entity = new MessageReceived(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  entity.messageId = event.params.messageId;
  entity.sourceChainSelector = event.params.sourceChainSelector;
  entity.sender = event.params.sender;
  entity.data = event.params.data;
  entity.blockNumber = event.block.number;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}

export function handleMessageSent(event: MessageSentEvent): void {
  let entity = new MessageSent(
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  );
  entity.messageId = event.params.messageId;
  entity.destinationChainSelector = event.params.destinationChainSelector;
  entity.receiver = event.params.receiver;
  entity.data = event.params.data;
  entity.feeToken = event.params.feeToken;
  entity.fees = event.params.fees;
  entity.blockNumber = event.block.number;
  entity.transactionHash = event.transaction.hash;
  entity.save();
}
