const SUBGRAPH_URL = process.env.NEXT_PUBLIC_SUBGRAPH_URL || '';

export type SubgraphActivity = {
  liquidityRebalanced: Array<{ id: string; poolId: string; newTickLower: string; newTickUpper: string; blockNumber: string }>;
  feeUpdated: Array<{ id: string; poolId: string; newFee: string; blockNumber: string }>;
  agentActionExecuted: Array<{ id: string; actionId: string; actionType: string; timestamp: string; blockNumber: string }>;
  messageSent: Array<{ id: string; messageId: string; destinationChainSelector: string; fees: string; blockNumber: string }>;
};

export type SubgraphPosition = {
  poolId: string;
  tickLower: string;
  tickUpper: string;
  feeBps: string;
  blockNumber: string;
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
    body: JSON.stringify({ query, variables: { limit: 50 } }),
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

export async function fetchPositions(): Promise<SubgraphPosition[] | null> {
  if (!SUBGRAPH_URL) return null;

  const query = `
    query Positions($limit: Int!) {
      liquidityRebalanceds(first: $limit, orderBy: blockNumber, orderDirection: desc) {
        id poolId newTickLower newTickUpper blockNumber
      }
      feeUpdateds(first: $limit, orderBy: blockNumber, orderDirection: desc) {
        id poolId newFee blockNumber
      }
    }
  `;

  const res = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { limit: 20 } }),
  });

  if (!res.ok) return null;
  const json = await res.json();
  if (json.errors) return null;

  const rebalances = json.data.liquidityRebalanceds ?? [];
  const fees = json.data.feeUpdateds ?? [];

  const feeMap = new Map<string, { fee: string; blockNumber: string }>();
  for (const fee of fees) {
    const existing = feeMap.get(fee.poolId);
    if (!existing || Number(fee.blockNumber) > Number(existing.blockNumber)) {
      feeMap.set(fee.poolId, { fee: fee.newFee, blockNumber: fee.blockNumber });
    }
  }

  const positionMap = new Map<string, SubgraphPosition>();
  for (const rebalance of rebalances) {
    const existing = positionMap.get(rebalance.poolId);
    if (!existing || Number(rebalance.blockNumber) > Number(existing.blockNumber)) {
      const fee = feeMap.get(rebalance.poolId);
      positionMap.set(rebalance.poolId, {
        poolId: rebalance.poolId,
        tickLower: rebalance.newTickLower,
        tickUpper: rebalance.newTickUpper,
        feeBps: fee ? `${fee.fee} bps` : '—',
        blockNumber: rebalance.blockNumber,
      });
    }
  }

  return Array.from(positionMap.values()).sort(
    (a, b) => Number(b.blockNumber) - Number(a.blockNumber)
  );
}
