import {
  distance,
  kruskalsMST,
  balancedClusterAssignment,
} from "./algorithms.js";
import {
  NUM_PLAYERS,
  PADDING,
  SOCIAL_CONNECTION_CHANCE,
  NUM_NODES,
  MIN_NODE_DISTANCE,
  MIN_POWERLINE_CAPACITY,
  MAX_POWERLINE_CAPACITY,
  CLUSTER_BALANCE_TOLERANCE,
} from "./config.js";
import { Node, Player, PowerEdge } from "./types.js";

export const generateCity = (width: number, height: number): Node[] => {
  const nodes: Node[] = [];

  while (nodes.length < NUM_NODES) {
    const node: Node = {
      x: Math.random() * (width - PADDING) + PADDING / 2,
      y: Math.random() * (height - PADDING) + PADDING / 2,
      id: nodes.length,
      currentEnergy: 0,
      attitude: "neutral",
      owner: null,
      isEnergyTower: false,
      socialConnections: [],
    };

    if (
      nodes.length === 0 ||
      nodes.every((n) => distance(n, node) > MIN_NODE_DISTANCE)
    ) {
      nodes.push(node);
    }
  }

  for (let i = 0; i < NUM_PLAYERS; i++) {
    nodes[i].isEnergyTower = true;
    nodes[i].owner = i;
  }

  return nodes;
};

export const generateSocialGraph = (nodes: Node[]): void => {
  for (let i = NUM_PLAYERS; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (Math.random() < SOCIAL_CONNECTION_CHANCE) {
        nodes[i].socialConnections.push(j);
        nodes[j].socialConnections.push(i);
      }
    }
  }
};

export const generateInitialPowerlines = (
  nodes: Node[],
  players: Player[]
): PowerEdge[] => {
  const powerlines: PowerEdge[] = [];
  const towers = nodes.filter((n) => n.isEnergyTower);
  const nonTowerNodes = nodes.filter((n) => !n.isEnergyTower);

  assignClusters(nonTowerNodes, towers, players, nodes);
  const clusterPowerlines = generateClusterPowerlines(nodes);
  powerlines.push(...clusterPowerlines);

  return powerlines;
};

const assignClusters = (
  nonTowerNodes: Node[],
  towers: Node[],
  players: Player[],
  allNodes: Node[]
) => {
  const balanceConstraint = createBalanceConstraint(allNodes);
  const assignments = balancedClusterAssignment(
    nonTowerNodes,
    towers,
    balanceConstraint
  );

  nonTowerNodes.forEach((node, index) => {
    const clusterId = assignments[index];
    node.owner = clusterId;
    players[clusterId].nodesSuppliedTo.push(node.id);
  });
};

const createBalanceConstraint = (nodes: Node[]) => {
  const targetSum = Math.ceil(
    nodes.reduce(
      (sum, n) => sum + n.socialConnections.reduce((a, b) => a + b, 0),
      0
    ) / NUM_PLAYERS
  );

  return (clusterId: number, node: Node) => {
    const currentSum = nodes
      .filter((n) => n.owner === clusterId)
      .reduce(
        (sum, n) => sum + n.socialConnections.reduce((a, b) => a + b, 0),
        0
      );

    return (
      currentSum + node.socialConnections.length <=
      targetSum * (1 + CLUSTER_BALANCE_TOLERANCE)
    );
  };
};

function generateClusterPowerlines(nodes: Node[]): PowerEdge[] {
  const powerlines: PowerEdge[] = [];

  for (let player = 0; player < NUM_PLAYERS; player++) {
    const clusterNodes = nodes.filter((n) => n.owner === player);
    if (clusterNodes.length < 2) continue;

    const clusterNodeIds = clusterNodes.map((n) => n.id);
    const mstEdges = kruskalsMST(nodes, clusterNodeIds);

    for (const edge of mstEdges) {
      edge.capacity =
        MIN_POWERLINE_CAPACITY +
        Math.floor(
          Math.random() * (MAX_POWERLINE_CAPACITY - MIN_POWERLINE_CAPACITY)
        );
      edge.owner = player;
      powerlines.push(edge);
    }
  }

  return powerlines;
}
