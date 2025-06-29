import {
  NUM_PLAYERS,
  INITIAL_PLAYER_ENERGY,
  ENERGY_TOWER_OUTPUT,
  ENERGY_DEFICIT_THRESHOLD,
  SABOTAGE_VOTE_THRESHOLD,
} from "./config.js";
import {
  generateCity,
  generateSocialGraph,
  generateInitialPowerlines,
} from "./generation.js";
import { canvas } from "./index.js";
import { renderPlayerUI, updateUI } from "./ui.js";
import { draw } from "./rendering.js";
import { BFSfindPath } from "./algorithms.js";
import type { Player, Node, PowerEdge, GameState } from "./types.js";

export class Game implements GameState {
  canvas: HTMLCanvasElement;
  currentPlayer: number = 0;
  turn: number = 1;
  players: Player[] = [];
  nodes: Node[] = [];
  powerEdges: PowerEdge[] = [];
  selectedNode: Node | null = null;
  dragStart: Node | null = null;
  gameOver: boolean = false;
  mouseX: number | null = 0;
  mouseY: number | null = 0;
  lastHoveredNode: Node | null = null;
  lastHoveredPowerline: PowerEdge | null = null;

  constructor() {
    this.canvas = canvas;
    this.players = Array.from(
      { length: NUM_PLAYERS },
      (_, i): Player => ({
        energy: INITIAL_PLAYER_ENERGY,
        color: `hsl(${(i * 360) / NUM_PLAYERS}, 100%, 50%)`,
        towerId: i,
        energyDraining: 0,
        energyGenerated: ENERGY_TOWER_OUTPUT,
        nodesSuppliedTo: [],
      })
    );

    this.init();
  }

  init(): void {
    this.nodes = generateCity(this.canvas.width, this.canvas.height);
    generateSocialGraph(this.nodes);
    this.powerEdges = generateInitialPowerlines(this.nodes, this.players);

    this.distributeInitialEnergy();

    const victoryModal = document.getElementById("victoryModal") as HTMLElement;
    if (victoryModal) {
      victoryModal.style.display = "none";
    }

    renderPlayerUI(this);
    updateUI(this);
    draw(this);
  }

  nextTurn(): void {
    if (this.gameOver) return;

    this.updateAttitudes();
    this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    this.turn++;

    this.players.forEach(
      (p) =>
        (p.energy = Math.min(
          p.energy + p.energyGenerated - p.energyDraining,
          50
        ))
    );

    updateUI(this);
    draw(this);
  }

  updateAttitudes(): void {
    this.nodes.forEach((node) => {
      if (node.isEnergyTower) return;

      const energyNeed = node.socialConnections.length;
      const deficit = energyNeed - node.currentEnergy;

      if (deficit <= 0) {
        node.attitude = "positive";
      } else if (deficit > ENERGY_DEFICIT_THRESHOLD) {
        node.attitude = "negative";
      } else {
        node.attitude = "neutral";
      }
    });

    this.nodes.forEach((node) => {
      if (node.attitude === "negative") {
        const votes = this.evaluateSabotageVotes(node);
        if (votes >= SABOTAGE_VOTE_THRESHOLD) {
          this.performSabotage(node);
        }
      }
    });
  }

  evaluateSabotageVotes(node: Node): number {
    let vote = 0;

    if (node.attitude === "negative") vote += 1;
    if (node.attitude === "positive") vote -= 1;

    node.socialConnections.forEach((id) => {
      const neighbor = this.nodes[id];
      if (!neighbor) return;

      const sameOwner = neighbor.owner === node.owner;

      if (neighbor.attitude === "positive") {
        vote += sameOwner ? -1 : +1;
      }
      if (neighbor.attitude === "negative") {
        vote += sameOwner ? +1 : -1;
      }
    });

    return vote;
  }

  performSabotage(node: Node): void {
    node.owner = null;
    const connected = this.powerEdges.filter(
      (edge) => edge.from === node.id || edge.to === node.id
    );

    if (connected.length === 0) return;

    const edgeGroups = new Map<number, PowerEdge[]>();
    connected.forEach((edge) => {
      if (!edgeGroups.has(edge.owner)) {
        edgeGroups.set(edge.owner, []);
      }
      edgeGroups.get(edge.owner)!.push(edge);
    });

    let targetEdges: PowerEdge[] = [];
    let min = Infinity;

    for (const [, edges] of edgeGroups.entries()) {
      if (edges.length < min) {
        min = edges.length;
        targetEdges = edges;
      } else if (edges.length === min) {
        targetEdges.push(...edges);
      }
    }

    if (targetEdges.length > 0) {
      const target =
        targetEdges[Math.floor(Math.random() * targetEdges.length)];
      const edgeIndex = this.powerEdges.indexOf(target);
      this.removeEdge(edgeIndex);
      console.log(
        `Sabotage! Node ${node.id} destroyed powerline of owner ${target.owner}.`
      );
    }
  }

  // Energy
  tryIncreaseNodeEnergy(nodeId: number): boolean {
    const node = this.nodes[nodeId];
    if (
      node.isEnergyTower ||
      node.owner === null ||
      node.currentEnergy == node.socialConnections.length
    )
      return false;

    const tower = this.findPlayerTower(node.owner);
    if (!tower) return false;

    let path = this.findPathToNode(tower.id, nodeId, node.owner);
    let bottleneck = this.findBottleneck(path);

    if (bottleneck === null) {
      this.recalculateAllFlows(node.owner);
      path = this.findPathToNode(tower.id, nodeId, node.owner);
      bottleneck = this.findBottleneck(path);
      if (bottleneck === null) return false;
    }

    this.increaseFlowAlongPath(path, 1);
    node.currentEnergy = (node.currentEnergy || 0) + 1;
    this.updatePlayerStats();
    return true;
  }

  tryDecreaseNodeEnergy(nodeId: number): boolean {
    const node = this.nodes[nodeId];
    if (node.isEnergyTower || node.owner === null || !node.currentEnergy)
      return false;

    const tower = this.findPlayerTower(node.owner);
    if (!tower) return false;

    const path = this.findPathToNode(tower.id, nodeId, node.owner);
    if (!path.length) return false;

    this.decreaseFlowAlongPath(path, 1);
    node.currentEnergy = Math.max(0, node.currentEnergy - 1);
    this.updatePlayerStats();
    return true;
  }

  tryConstructEdge(
    fromId: number,
    toId: number,
    playerId: number,
    capacity: number,
    cost: number
  ): boolean {
    const toNode = this.nodes[toId];
    const player = this.players[playerId];

    if (player.energy < cost) return false;

    if (toNode.owner === null) {
      toNode.owner = playerId;
      this.createEdge(fromId, toId, playerId, capacity);
      player.energy -= cost;
      this.updatePlayerStats();
      return true;
    } else if (toNode.owner === playerId) {
      this.createEdge(fromId, toId, playerId, capacity);
      player.energy -= cost;
      return true;
    } else {
      const currentEnergy = toNode.currentEnergy || 0;
      const maxPossibleEnergy = toNode.socialConnections.length;

      if (currentEnergy > maxPossibleEnergy / 2) {
        return false;
      } else {
        const oldOwner = toNode.owner;
        this.disconnectNodeFromOwner(toNode.id, oldOwner);
        toNode.owner = playerId;
        toNode.currentEnergy = 0;
        this.createEdge(fromId, toId, playerId, capacity);
        player.energy -= cost;

        const disconnected = this.findDisconnectedNodesAfterNodeLoss(
          toNode.id,
          oldOwner
        );
        disconnected.forEach((nodeId) => {
          const node = this.nodes[nodeId];
          node.owner = null;
          node.currentEnergy = 0;
        });

        this.recalculateAllFlows(oldOwner);
        this.recalculateAllFlows(playerId);
        this.updatePlayerStats();

        return true;
      }
    }
  }

  removeEdge(edgeIndex: number): void {
    const edge = this.powerEdges[edgeIndex];
    const playerId = edge.owner;

    const disconnectedNodes = this.findDisconnectedNodes(edge, playerId);

    disconnectedNodes.forEach((nodeId) => {
      const node = this.nodes[nodeId];
      if (node.owner === playerId && !node.isEnergyTower) {
        node.currentEnergy = 0;
        this.redistributeEnergyAfterDisconnection(nodeId, playerId);
      }
    });

    this.powerEdges.splice(edgeIndex, 1);
    this.updatePlayerStats();
  }

  // Helpers
  private findDisconnectedNodesAfterNodeLoss(
    lostNodeId: number,
    playerId: number
  ): number[] {
    const tower = this.findPlayerTower(playerId);
    if (!tower) return [];

    const remainingEdges = this.powerEdges.filter((e) => e.owner === playerId);

    const visited = new Set<number>();
    const queue = [tower.id];

    while (queue.length > 0) {
      const current = queue.shift()!;
      visited.add(current);

      for (const edge of remainingEdges) {
        if (
          edge.from === current &&
          edge.to !== lostNodeId &&
          !visited.has(edge.to)
        ) {
          queue.push(edge.to);
        } else if (
          edge.to === current &&
          edge.from !== lostNodeId &&
          !visited.has(edge.from)
        ) {
          queue.push(edge.from);
        }
      }
    }

    return this.nodes
      .map((node, id) => ({ node, id }))
      .filter(
        ({ node, id }) =>
          node.owner === playerId && !node.isEnergyTower && !visited.has(id)
      )
      .map(({ id }) => id);
  }

  private findPlayerTower(playerId: number): Node | null {
    return (
      this.nodes.find((n) => n.isEnergyTower && n.owner === playerId) || null
    );
  }

  private findPathToNode(
    fromId: number,
    toId: number,
    playerId: number
  ): PowerEdge[] {
    const playerEdges = this.powerEdges.filter((e) => e.owner === playerId);

    if (!BFSfindPath(fromId, toId, playerEdges, playerId)) return [];

    const graph = new Map<number, PowerEdge[]>();
    playerEdges.forEach((edge) => {
      if (!graph.has(edge.from)) graph.set(edge.from, []);
      if (!graph.has(edge.to)) graph.set(edge.to, []);
      graph.get(edge.from)!.push(edge);
      graph.get(edge.to)!.push(edge);
    });

    const queue = [{ nodeId: fromId, path: [] as PowerEdge[] }];
    const visited = new Set([fromId]);

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === toId) return path;

      for (const edge of graph.get(nodeId) || []) {
        const nextNode = edge.from === nodeId ? edge.to : edge.from;
        if (!visited.has(nextNode)) {
          visited.add(nextNode);
          queue.push({ nodeId: nextNode, path: [...path, edge] });
        }
      }
    }

    return [];
  }

  private findBottleneck(path: PowerEdge[]): number | null {
    for (const edge of path) {
      if (edge.currentFlow >= edge.capacity) return null;
    }
    return Math.min(...path.map((e) => e.capacity - e.currentFlow));
  }

  private increaseFlowAlongPath(path: PowerEdge[], amount: number): void {
    path.forEach((edge) => {
      edge.currentFlow = Math.min(edge.capacity, edge.currentFlow + amount);
    });
  }

  private decreaseFlowAlongPath(path: PowerEdge[], amount: number): void {
    path.forEach((edge) => {
      edge.currentFlow = Math.max(0, edge.currentFlow - amount);
    });
  }

  private createEdge(
    fromId: number,
    toId: number,
    playerId: number,
    capacity: number
  ): void {
    this.powerEdges.push({
      from: fromId,
      to: toId,
      owner: playerId,
      capacity,
      currentFlow: 0,
    });
  }

  private disconnectNodeFromOwner(nodeId: number, oldOwner: number): void {
    const tower = this.findPlayerTower(oldOwner);
    if (!tower) return;

    const path = this.findPathToNode(tower.id, nodeId, oldOwner);
    if (path.length === 0) return;

    const node = this.nodes[nodeId];
    const energyToRemove = node.currentEnergy || 0;

    this.decreaseFlowAlongPath(path, energyToRemove);
  }

  private findDisconnectedNodes(
    removedEdge: PowerEdge,
    playerId: number
  ): number[] {
    const remainingEdges = this.powerEdges.filter(
      (e) => e !== removedEdge && e.owner === playerId
    );
    const tower = this.findPlayerTower(playerId);
    if (!tower) return [];

    const disconnected: number[] = [];
    const playerNodes = this.nodes
      .map((n, i) => ({ node: n, id: i }))
      .filter(({ node }) => node.owner === playerId && !node.isEnergyTower);

    for (const { id } of playerNodes) {
      if (!BFSfindPath(tower.id, id, remainingEdges, playerId)) {
        disconnected.push(id);
      }
    }

    return disconnected;
  }

  private redistributeEnergyAfterDisconnection(
    nodeId: number,
    playerId: number
  ): void {
    this.recalculateAllFlows(playerId);
  }

  private recalculateAllFlows(playerId: number): void {
    const tower = this.findPlayerTower(playerId);
    if (!tower) return;

    const playerEdges = this.powerEdges.filter((e) => e.owner === playerId);
    const playerNodes = this.nodes.filter(
      (n) => n.owner === playerId && !n.isEnergyTower
    );

    playerEdges.forEach((e) => (e.currentFlow = 0));

    for (const node of playerNodes) {
      const demand = node.currentEnergy || 0;
      if (demand > 0) {
        const path = this.findPathToNode(tower.id, node.id, playerId);
        if (path.length > 0) {
          this.increaseFlowAlongPath(path, demand);
        }
      }
    }
  }

  private updatePlayerStats(): void {
    this.players.forEach((player) => {
      player.nodesSuppliedTo = [];
      player.energyDraining = 0;
      player.energyGenerated = 0;

      this.nodes.forEach((node, id) => {
        if (node.owner === player.towerId && !node.isEnergyTower) {
          player.nodesSuppliedTo.push(id);
          player.energyDraining += node.currentEnergy || 0;
        }
      });

      const towers = this.nodes.filter(
        (n) => n.isEnergyTower && n.owner === player.towerId
      );
      player.energyGenerated = towers.length * ENERGY_TOWER_OUTPUT;
    });
  }

  private distributeInitialEnergy(): void {
    const playerGroups = new Map<number, Array<Node & { id: number }>>();
    this.nodes.forEach((n, id) => {
      if (n.owner !== null && !n.isEnergyTower) {
        if (!playerGroups.has(n.owner)) playerGroups.set(n.owner, []);
        playerGroups.get(n.owner)!.push({ ...n, id });
      }
    });

    for (const [playerId, group] of playerGroups) {
      const totalConnections = group.reduce(
        (sum, n) => sum + n.socialConnections.length,
        0
      );
      if (totalConnections === 0) continue;

      const towers = this.nodes.filter(
        (n) => n.isEnergyTower && n.owner === playerId
      );
      const totalEnergy = towers.length * ENERGY_TOWER_OUTPUT;

      group.forEach((nodeWithId) => {
        const share = nodeWithId.socialConnections.length / totalConnections;
        const energyAmount = Math.min(
          Math.floor(totalEnergy * share),
          nodeWithId.socialConnections.length
        );

        const node = this.nodes[nodeWithId.id];
        node.currentEnergy = 0;

        for (let i = 0; i < energyAmount; i++) {
          if (!this.tryIncreaseNodeEnergy(nodeWithId.id)) break;
        }
      });
    }
  }

  newGame(): void {
    this.currentPlayer = 0;
    this.turn = 1;
    this.selectedNode = null;
    this.dragStart = null;
    this.gameOver = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.lastHoveredNode = null;
    this.lastHoveredPowerline = null;

    this.players = Array.from(
      { length: NUM_PLAYERS },
      (_, i): Player => ({
        energy: INITIAL_PLAYER_ENERGY,
        color: `hsl(${(i * 360) / NUM_PLAYERS}, 100%, 50%)`,
        towerId: i,
        energyDraining: 0,
        energyGenerated: ENERGY_TOWER_OUTPUT,
        nodesSuppliedTo: [],
      })
    );

    this.init();
  }
}
