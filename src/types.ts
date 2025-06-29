export interface Point {
  x: number;
  y: number;
}

export interface Node extends Point {
  id: number;
  currentEnergy: number;
  attitude: "positive" | "negative" | "neutral";
  owner: number | null;
  isEnergyTower: boolean;
  socialConnections: number[];
  width: number;
  height: number;
}

export interface PowerEdge {
  from: number;
  to: number;
  owner: number;
  capacity: number;
  currentFlow: number;
}

export interface Player {
  energy: number;
  color: string;
  towerId: number;
  energyDraining: number;
  energyGenerated: number;
}

export interface GameState {
  canvas: HTMLCanvasElement;
  currentPlayer: number;
  turn: number;
  players: Player[];
  nodes: Node[];
  powerEdges: PowerEdge[];
  selectedNode: Node | null;
  dragStart: Node | null;
  gameOver: boolean;
  mouseX: number | null;
  mouseY: number | null;
  lastHoveredNode: Node | null;
  lastHoveredPowerline: PowerEdge | null;
}

export type AttitudeType = "positive" | "negative" | "neutral";
