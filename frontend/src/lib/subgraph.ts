const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL || '';

export type SubgraphActivity = {
  liquidityRebalanced: Array<{ id: string; poolId: string; newTickLower: string; newTickUpper: string; blockNumber: string }>;
  feeUpdated: Array<{ id: string; poolId: string; newFee: string; blockNumber: string }>;
  agentActionExecuted: Array<{ id: string; actionId: string; actionType: string; timestamp: string; blockNumber: string }>;
  messageSent: Array<{ id: string; messageId: string; destinationChainSelector: string; fees: string; blockNumber: string }>;
};

export async function fetchActivity(): Promise<SubgraphActivity | null> {
  if (!SUBGRAPH_URL) return null;

  const query = `
    query Activity($limit: Int!) {
      liquidityRebalanceds(first: $limit, orderBy: blockNumber, orderDirection: desc) {
        id poolId newTickLower newTickUpper blockNumber
      }
      feeUpdateds(first: $limit, orderBy: blockNumber, orderDirection: desc) {
        id poolId newFee blockNumber
      }
      agentActionExecuteds(first: $limit, orderBy: blockNumber, orderDirection: desc) {
        id actionId actionType timestamp blockNumber
      }
      messageSents(first: $limit, orderBy: blockNumber, orderDirection: desc) {
        id messageId destinationChainSelector fees blockNumber
      }
    }
  `;

  const res = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { limit: 5 } }),
  });

  if (!res.ok) return null;
  const json = await res.json();
  if (json.errors) return null;

  return {
    liquidityRebalanced: json.data.liquidityRebalanceds ?? [],
    feeUpdated: json.data.feeUpdateds ?? [],
    agentActionExecuted: json.data.agentActionExecuteds ?? [],
    messageSent: json.data.messageSents ?? [],
  };
}
