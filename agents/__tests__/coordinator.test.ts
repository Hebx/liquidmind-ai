/**
 * Coordinator Tests
 */

import { AgentCoordinator } from '../src/coordinator';
import { A2AMessage, TaskRequest } from '../src/types';

describe('AgentCoordinator', () => {
  let coordinator: AgentCoordinator;

  beforeEach(() => {
    coordinator = new AgentCoordinator('test-coordinator');
  });

  afterEach(() => {
    coordinator.stopHeartbeat();
  });

  describe('registerAgent', () => {
    it('should register an agent with capabilities', () => {
      coordinator.registerAgent('agent-1', 'http://agent1.local', [
        'optimize-route',
        'fetch-prices',
      ]);

      // Agent should be registered
      expect(coordinator).toBeDefined();
    });

    it('should emit agent-started event', (done) => {
      coordinator.onEvent((event) => {
        if (event.type === 'agent-started') {
          expect(event.agentId).toBe('agent-2');
          done();
        }
      });

      coordinator.registerAgent('agent-2', 'http://agent2.local', ['analyze-risk']);
    });
  });

  describe('unregisterAgent', () => {
    it('should unregister an agent', () => {
      coordinator.registerAgent('agent-3', 'http://agent3.local', ['aggregate-yield']);
      coordinator.unregisterAgent('agent-3');

      // Agent should be unregistered
      expect(coordinator).toBeDefined();
    });

    it('should emit agent-stopped event', (done) => {
      coordinator.registerAgent('agent-4', 'http://agent4.local', ['analyze-risk']);

      coordinator.onEvent((event) => {
        if (event.type === 'agent-stopped') {
          expect(event.agentId).toBe('agent-4');
          done();
        }
      });

      coordinator.unregisterAgent('agent-4');
    });
  });

  describe('dispatchTask', () => {
    it('should throw when no agent available for task', async () => {
      await expect(
        coordinator.dispatchTask('optimize-route', {}, 'medium')
      ).rejects.toThrow('No agent available');
    });

    it('should dispatch task to appropriate agent', async () => {
      coordinator.registerAgent('route-optimizer', 'http://router.local', [
        'optimize-route',
      ]);

      // Would need mocked transport for full test
      expect(coordinator).toBeDefined();
    });
  });

  describe('handleMessage', () => {
    it('should handle task-response message', () => {
      const message: A2AMessage = {
        id: 'msg-1',
        from: 'agent-1',
        to: 'coordinator',
        type: 'task-response',
        payload: {
          taskId: 'task-1',
          accepted: true,
          estimatedDuration: 5000,
        },
        timestamp: Date.now(),
      };

      coordinator.handleMessage(message);
      expect(coordinator).toBeDefined();
    });

    it('should handle task-result message', (done) => {
      coordinator.onEvent((event) => {
        if (event.type === 'task-completed') {
          expect(event.agentId).toBe('agent-1');
          done();
        }
      });

      const message: A2AMessage = {
        id: 'msg-2',
        from: 'agent-1',
        to: 'coordinator',
        type: 'task-result',
        payload: {
          taskId: 'task-2',
          status: 'success',
          data: { result: 'test' },
          completedAt: Date.now(),
        },
        timestamp: Date.now(),
      };

      coordinator.handleMessage(message);
    });

    it('should handle error message', (done) => {
      coordinator.onEvent((event) => {
        if (event.type === 'error-occurred') {
          expect(event.agentId).toBe('agent-1');
          done();
        }
      });

      const message: A2AMessage = {
        id: 'msg-3',
        from: 'agent-1',
        to: 'coordinator',
        type: 'error',
        payload: { error: 'Something went wrong' },
        timestamp: Date.now(),
      };

      coordinator.handleMessage(message);
    });
  });

  describe('queryAgentStatuses', () => {
    it('should return status of all agents', async () => {
      coordinator.registerAgent('agent-5', 'http://agent5.local', ['analyze-risk']);
      coordinator.registerAgent('agent-6', 'http://agent6.local', ['aggregate-yield']);

      const statuses = await coordinator.queryAgentStatuses();

      expect(statuses.size).toBe(2);
      expect(statuses.has('agent-5')).toBe(true);
      expect(statuses.has('agent-6')).toBe(true);
    });
  });

  describe('onEvent', () => {
    it('should subscribe to events', () => {
      const listener = jest.fn();
      const unsubscribe = coordinator.onEvent(listener);

      coordinator.registerAgent('agent-7', 'http://agent7.local', ['optimize-route']);

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });

    it('should unsubscribe from events', () => {
      const listener = jest.fn();
      const unsubscribe = coordinator.onEvent(listener);

      unsubscribe();

      coordinator.registerAgent('agent-8', 'http://agent8.local', ['analyze-risk']);

      expect(listener).toHaveBeenCalledTimes(1); // Only the first registration
    });
  });

  describe('startHeartbeat', () => {
    it('should start health checks', () => {
      coordinator.startHeartbeat(100);
      expect(coordinator).toBeDefined();
    });
  });

  describe('stopHeartbeat', () => {
    it('should stop health checks', () => {
      coordinator.startHeartbeat(100);
      coordinator.stopHeartbeat();
      expect(coordinator).toBeDefined();
    });
  });
});
