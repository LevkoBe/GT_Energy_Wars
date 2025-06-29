import { distance, distanceToLineSegment } from "./algorithms.js";
import { Node, PowerEdge, GameState } from "./types.js";

export const getNodeAt = (x: number, y: number, game: GameState): Node | null =>
  game.nodes.find((node) => distance({ x, y }, node) < 25) || null;

export const getPowerlineAt = (
  x: number,
  y: number,
  game: GameState
): PowerEdge | null => {
  return (
    game.powerEdges.find((edge) => {
      const nodeA = game.nodes[edge.from];
      const nodeB = game.nodes[edge.to];
      const distToLine = distanceToLineSegment({ x, y }, nodeA, nodeB);
      return distToLine < 10;
    }) || null
  );
};

const drawSocialConnections = (
  ctx: CanvasRenderingContext2D,
  game: GameState
) => {
  game.nodes.forEach((node) => {
    node.socialConnections?.forEach((id) => {
      const target = game.nodes.find((n) => n.id === id);
      if (target) {
        ctx.strokeStyle = "rgba(128, 128, 128, 0.4)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  });
};

const drawPowerlines = (ctx: CanvasRenderingContext2D, game: GameState) => {
  game.powerEdges.forEach((edge) => {
    const a = game.nodes[edge.from];
    const b = game.nodes[edge.to];
    const color = game.players[edge.owner].color;

    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, edge.capacity / 4);
    ctx.shadowColor = color;
    ctx.shadowBlur = 5;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;

    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.beginPath();
    ctx.roundRect(midX - 12, midY - 10, 24, 16, 4);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${edge.currentFlow}/${edge.capacity}`, midX, midY + 3);
  });
};

const drawNode = (
  ctx: CanvasRenderingContext2D,
  node: Node,
  game: GameState
) => {
  const energyNeed = node.socialConnections?.length || 1;
  const size = 10 + energyNeed * 2;
  const playerColor =
    node.owner !== null ? game.players[node.owner].color : "#666";

  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = node.isEnergyTower ? "#fff" : playerColor;

  if (node.isEnergyTower) {
    ctx.beginPath();
    ctx.arc(node.x, node.y, 15, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(node.x - size / 2, node.y - size / 2, size, size);
  }

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  if (!node.isEnergyTower) {
    drawEnergyDots(
      ctx,
      node.x,
      node.y + size / 2 + 10,
      node.currentEnergy,
      energyNeed
    );
  }

  ctx.fillStyle = "#fff";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;

  const energyText = node.isEnergyTower
    ? `Player ${node.owner !== null ? node.owner + 1 : "?"}`
    : `${node.currentEnergy}/${energyNeed}`;

  ctx.strokeText(energyText, node.x, node.y + 4);
  ctx.fillText(energyText, node.x, node.y + 4);
};

const drawEnergyDots = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  current: number,
  total: number
): void => {
  const radius = 2;
  const gap = 5;
  const startX = x - ((total - 1) * gap) / 2;

  for (let i = 0; i < total; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * gap, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = i < current ? "#2ed573" : "#555";
    ctx.fill();
  }
};

const drawDragLine = (ctx: CanvasRenderingContext2D, game: GameState) => {
  if (!game.dragStart) return;

  const color = game.players[game.currentPlayer].color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([5, 5]);
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.moveTo(game.dragStart.x, game.dragStart.y);
  ctx.lineTo(game.mouseX || 0, game.mouseY || 0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
};

const drawTooltip = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lines: string[],
  backgroundColor: string = "rgba(0, 0, 0, 0.9)"
): void => {
  const padding = 12;
  const lineHeight = 16;
  const fontSize = 12;

  ctx.font = `${fontSize}px Arial`;
  const maxWidth = Math.max(
    ...lines.map((line) => ctx.measureText(line).width)
  );
  const tooltipWidth = maxWidth + padding * 2;
  const tooltipHeight = lines.length * lineHeight + padding * 2;

  let tooltipX = x + 15;
  let tooltipY = y - tooltipHeight - 10;

  if (tooltipX + tooltipWidth > ctx.canvas.width)
    tooltipX = x - tooltipWidth - 15;
  if (tooltipY < 0) tooltipY = y + 15;

  ctx.fillStyle = backgroundColor;
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.beginPath();
  ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 8);
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  lines.forEach((line, index) => {
    ctx.fillText(
      line,
      tooltipX + padding,
      tooltipY + padding + (index + 1) * lineHeight
    );
  });
};

const drawHoveredNodeTooltip = (
  ctx: CanvasRenderingContext2D,
  game: GameState
) => {
  if (!game.mouseX || !game.mouseY) return;

  const node = getNodeAt(game.mouseX, game.mouseY, game);
  if (!node) return;

  const tooltipLines = node.isEnergyTower
    ? [
        `Energy Tower #${node.id}`,
        `Owner: ${node.owner !== null ? `Player ${node.owner + 1}` : "None"}`,
        `Generates unlimited energy`,
      ]
    : [
        `Node #${node.id}`,
        `Owner: ${node.owner !== null ? `Player ${node.owner + 1}` : "None"}`,
        `Energy: ${node.currentEnergy}/${node.socialConnections?.length || 1}`,
        `Attitude: ${node.attitude || "neutral"}`,
        `Connections: ${node.socialConnections?.length || 0}`,
      ];

  drawTooltip(ctx, game.mouseX, game.mouseY, tooltipLines);
};

export const draw = (game: GameState): void => {
  const ctx = game.canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);

  drawSocialConnections(ctx, game);
  drawPowerlines(ctx, game);
  game.nodes.forEach((node) => drawNode(ctx, node, game));
  drawDragLine(ctx, game);
  drawHoveredNodeTooltip(ctx, game);
};
