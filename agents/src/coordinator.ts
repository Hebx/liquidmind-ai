import { A2AMessage, TaskRequest, TaskResponse, TaskResult, AgentEvent, EventType } from './types';

/**
 * Main Agent Coordinator
 * 
 * Orchestrates communication between specialized agents using A2A protocol.
 * Routes tasks to appropriate agents and aggregates results.
 */

export class AgentCoordinator {
  private agents: Map<string, AgentConnection> = new Map();
  private tasks: Map<string, TaskState> = new Map();
  private eventListeners: Set<(event: AgentEvent) => void> = new Set();
  private agentId: string;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  /**
   * Register an agent in the coordinator
   */
  registerAgent(agentId: string, endpoint: string, capabilities: string[]): void {
    this.agents.set(agentId, {
      id: agentId,
      endpoint,
      capabilities,
      status: 'idle',
      lastSeen: Date.now(),
    });

    this.emitEvent({
      type: 'agent-started',
      agentId,
      timestamp: Date.now(),
      data: { capabilities },
    });
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
    this.emitEvent({
      type: 'agent-stopped',
      agentId,
      timestamp: Date.now(),
      data: {},
    });
  }

  /**
   * Dispatch a task to the appropriate agent
   */
  async dispatchTask(
    taskType: string,
    params: Record<string, unknown>,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<TaskResult> {
    const taskId = this.generateTaskId();
    const targetAgent = this.selectAgentForTask(taskType);

    if (!targetAgent) {
      throw new Error(`No agent available for task type: ${taskType}`);
    }

    const taskRequest: TaskRequest = {
      taskId,
      taskType: taskType as any,
      priority,
      params,
    };

    const message: A2AMessage = {
      id: this.generateMessageId(),
      from: this.agentId,
      to: targetAgent.id,
      type: 'task-request',
      payload: taskRequest,
      timestamp: Date.now(),
    };

    // Track task state
    this.tasks.set(taskId, {
      id: taskId,
      type: taskType,
      status: 'pending',
      targetAgent: targetAgent.id,
      createdAt: Date.now(),
    });

    this.emitEvent({
      type: 'task-received',
      agentId: targetAgent.id,
      timestamp: Date.now(),
      data: { taskId, taskType },
    });

    // Send task and wait for response
    return this.sendTaskAndWait(message, taskId);
  }

  /**
   * Handle incoming messages from other agents
   */
  handleMessage(message: A2AMessage): void {
    switch (message.type) {
      case 'task-response':
        this.handleTaskResponse(message);
        break;
      case 'task-result':
        this.handleTaskResult(message);
        break;
      case 'status-response':
        this.handleStatusResponse(message);
        break;
      case 'error':
        this.handleError(message);
        break;
      default:
        console.log(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Get status of all registered agents
   */
  async queryAgentStatuses(): Promise<Map<string, AgentStatus>> {
    const statuses = new Map<string, AgentStatus>();

    for (const [agentId, agent] of this.agents) {
      try {
        const status = await this.queryAgentStatus(agentId);
        statuses.set(agentId, status);
      } catch {
        statuses.set(agentId, 'offline');
      }
    }

    return statuses;
  }

  /**
   * Subscribe to agent events
   */
  onEvent(listener: (event: AgentEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Start coordinator heartbeat
   */
  startHeartbeat(intervalMs: number = 30000): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkAgentHealth();
    }, intervalMs);
  }

  /**
   * Stop coordinator heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  // Private methods

  private selectAgentForTask(taskType: string): AgentConnection | undefined {
    // Find agent with matching capability
    for (const [_, agent] of this.agents) {
      if (agent.capabilities.includes(taskType) && agent.status !== 'busy') {
        return agent;
      }
    }
    return undefined;
  }

  private async sendTaskAndWait(message: A2AMessage, taskId: string): Promise<TaskResult> {
    // In real implementation, this would send HTTP/WebSocket message
    // and wait for response with timeout
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.tasks.delete(taskId);
        reject(new Error(`Task ${taskId} timed out`));
      }, 60000);

      // Store resolver for when result arrives
      const taskState = this.tasks.get(taskId);
      if (taskState) {
        taskState.resolve = (result: TaskResult) => {
          clearTimeout(timeout);
          resolve(result);
        };
        taskState.reject = (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        };
      }
    });
  }

  private handleTaskResponse(message: A2AMessage): void {
    const response = message.payload as TaskResponse;
    const taskState = this.tasks.get(response.taskId);
    
    if (taskState) {
      taskState.status = response.accepted ? 'in-progress' : 'failed';
      if (!response.accepted) {
        taskState.reject?.(new Error(response.reason || 'Task rejected'));
      }
    }
  }

  private handleTaskResult(message: A2AMessage): void {
    const result = message.payload as TaskResult;
    const taskState = this.tasks.get(result.taskId);
    
    if (taskState) {
      taskState.status = result.status === 'success' ? 'completed' : 'failed';
      taskState.result = result;
      
      if (result.status === 'success') {
        taskState.resolve?.(result);
      } else {
        taskState.reject?.(new Error(result.error || 'Task failed'));
      }
    }

    this.emitEvent({
      type: result.status === 'success' ? 'task-completed' : 'task-failed',
      agentId: message.from,
      timestamp: Date.now(),
      data: { taskId: result.taskId, status: result.status },
    });
  }

  private handleStatusResponse(message: A2AMessage): void {
    const agent = this.agents.get(message.from);
    if (agent) {
      agent.lastSeen = Date.now();
      agent.status = (message.payload as any).status;
    }
  }

  private handleError(message: A2AMessage): void {
    console.error(`Error from agent ${message.from}:`, message.payload);
    this.emitEvent({
      type: 'error-occurred',
      agentId: message.from,
      timestamp: Date.now(),
      data: message.payload,
    });
  }

  private async queryAgentStatus(agentId: string): Promise<AgentStatus> {
    // In real implementation, send status query and wait for response
    const agent = this.agents.get(agentId);
    return agent?.status || 'offline';
  }

  private checkAgentHealth(): void {
    const now = Date.now();
    for (const [agentId, agent] of this.agents) {
      if (now - agent.lastSeen > 120000) { // 2 minutes
        agent.status = 'offline';
      }
    }
  }

  private emitEvent(event: AgentEvent): void {
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }

  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper types
interface AgentConnection {
  id: string;
  endpoint: string;
  capabilities: string[];
  status: AgentStatus;
  lastSeen: number;
}

type AgentStatus = 'idle' | 'busy' | 'error' | 'offline';

interface TaskState {
  id: string;
  type: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  targetAgent: string;
  createdAt: number;
  result?: TaskResult;
  resolve?: (result: TaskResult) => void;
  reject?: (error: Error) => void;
}
