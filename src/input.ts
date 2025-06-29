import { updateUI } from "./ui.js";
import { draw, getNodeAt } from "./rendering.js";
import { distance, BFSfindPath } from "./algorithms.js";
import {
  MIN_POWERLINE_CAPACITY,
  MAX_POWERLINE_CAPACITY,
  POWERLINE_COST_DISTANCE_DIVISOR,
} from "./config.js";
import type { Game } from "./Game.js";
import type { Node, PowerEdge } from "./types.js";

function getCanvasCoordinates(e: MouseEvent, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

function findExistingEdge(
  from: number,
  to: number,
  edges: PowerEdge[]
): PowerEdge | undefined {
  return edges.find(
    (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from)
  );
}

function handleNodeClick(game: Game, node: Node, isRightClick: boolean) {
  const player = game.players[game.currentPlayer];
  const towerId = player.towerId;

  const pathExists = BFSfindPath(
    towerId,
    node.id,
    game.powerEdges,
    game.currentPlayer
  );
  if (!pathExists) return;

  if (isRightClick && node.currentEnergy > 0) {
    game.tryDecreaseNodeEnergy(node.id);
  } else if (!isRightClick && player.energy > 0) {
    game.tryIncreaseNodeEnergy(node.id);
  }
}

export function handleClick(
  e: MouseEvent,
  game: Game | null,
  isRightClick = false
) {
  if (!game || game.gameOver) return;

  const { x, y } = getCanvasCoordinates(e, game.canvas);
  const clickedNode = getNodeAt(x, y, game);
  if (clickedNode) {
    game.selectedNode = clickedNode;
    if (!clickedNode.isEnergyTower) {
      handleNodeClick(game, clickedNode, isRightClick);
    }
  }

  updateUI(game);
  draw(game);
}

export function handleMouseDown(e: MouseEvent, game: Game | null) {
  if (!game || game.gameOver) return;

  const { x, y } = getCanvasCoordinates(e, game.canvas);
  const clickedNode = getNodeAt(x, y, game);
  if (clickedNode) game.dragStart = clickedNode;
}

export function handleMouseMove(e: MouseEvent, game: Game | null) {
  if (!game) return;

  const { x, y } = getCanvasCoordinates(e, game.canvas);
  game.mouseX = x;
  game.mouseY = y;

  const hoveredNode = getNodeAt(x, y, game);
  const hadHover = game.lastHoveredNode || game.lastHoveredPowerline;

  game.lastHoveredNode = hoveredNode;

  if (hoveredNode) {
    game.canvas.style.cursor = "pointer";
  } else if (game.dragStart) {
    game.canvas.style.cursor = "grabbing";
  } else {
    game.canvas.style.cursor = "default";
  }

  if (game.dragStart || hoveredNode || hadHover) draw(game);
}

function handleDragConnection(game: Game, from: Node, to: Node) {
  const player = game.players[game.currentPlayer];
  const dist = distance(from, to);
  const capRange = MAX_POWERLINE_CAPACITY - MIN_POWERLINE_CAPACITY;
  const capacity =
    MIN_POWERLINE_CAPACITY + Math.floor(Math.random() * capRange);
  const cost = Math.floor(dist / POWERLINE_COST_DISTANCE_DIVISOR) + capacity;

  if (player.energy < cost) return;

  const existing = findExistingEdge(from.id, to.id, game.powerEdges);
  if (existing) {
    if (existing.owner === game.currentPlayer) {
      existing.capacity += capacity;
      player.energy -= cost;
    }
  } else {
    game.tryConstructEdge(from.id, to.id, game.currentPlayer, capacity, cost);
  }
}

export function handleMouseUp(e: MouseEvent, game: Game | null) {
  if (!game || game.gameOver || !game.dragStart) return;

  const { x, y } = getCanvasCoordinates(e, game.canvas);
  const targetNode = getNodeAt(x, y, game);
  if (targetNode && targetNode !== game.dragStart) {
    handleDragConnection(game, game.dragStart, targetNode);
  }

  game.dragStart = null;
  game.canvas.style.cursor = "default";
  updateUI(game);
  draw(game);
}

export function handleMouseLeave(game: Game | null) {
  if (!game) return;

  game.mouseX = null;
  game.mouseY = null;
  game.lastHoveredNode = null;
  game.lastHoveredPowerline = null;
  game.canvas.style.cursor = "default";
  draw(game);
}
