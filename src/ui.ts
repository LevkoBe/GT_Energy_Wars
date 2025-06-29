import type { Game } from "./Game.js";

export const renderPlayerUI = (game: Game): void => {
  const container = document.getElementById("playersContainer");
  if (!container) return;

  container.innerHTML = "";

  game.players.forEach((player, idx) => {
    const playerHTML = `
      <div class="player-info">
        <div class="player-header">
          <h3>Player ${idx + 1}</h3>
          <div class="player-energy">
            ⚡ <span id="p${idx + 1}Energy">${player.energy}</span>
          </div>
        </div>
        <div class="player-stats">
          <span>Gain: <span id="p${idx + 1}Gain">${
      player.energyGenerated
    }</span></span>
          <span>Drain: <span id="p${idx + 1}Drain">${
      player.energyDraining
    }</span></span>
          <span>Supplied: <span id="p${idx + 1}Supply">${
      player.nodesSuppliedTo.length
    }</span></span>
        </div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", playerHTML);
  });
};

export const updateUI = (game: Game): void => {
  game.players.forEach((player, idx) => {
    const energyEl = document.getElementById(`p${idx + 1}Energy`);
    const drainEl = document.getElementById(`p${idx + 1}Drain`);
    const gainEl = document.getElementById(`p${idx + 1}Gain`);
    const supplyEl = document.getElementById(`p${idx + 1}Supply`);

    if (supplyEl)
      supplyEl.textContent = player.nodesSuppliedTo
        .reduce(
          (sum, nodeId) => sum + game.nodes[nodeId].socialConnections.length,
          0
        )
        .toString();
    if (energyEl) energyEl.textContent = player.energy.toString();
    if (drainEl) drainEl.textContent = player.energyDraining.toString();
    if (gainEl) gainEl.textContent = player.energyGenerated.toString();

    const influenceBar = document.getElementById(
      `p${idx + 1}Influence`
    ) as HTMLElement;
    if (influenceBar) {
      influenceBar.style.width = "0%";
    }
  });

  const status = document.getElementById("gameStatus");
  if (status) {
    status.textContent = `Turn ${game.turn} - Player ${game.currentPlayer + 1}`;
  }

  const nodeInfo = document.getElementById("nodeInfo");
  if (nodeInfo) {
    const node = game.selectedNode;
    if (node) {
      nodeInfo.innerHTML = `
        <div class="node-info-content">
          <strong>Node ${node.id}</strong><br>
          Owner: ${
            node.owner !== null ? "Player " + (node.owner + 1) : "None"
          }<br>
          Energy: ${node.currentEnergy}/${node.socialConnections.length}<br>
          Attitude: <span class="attitude-${node.attitude}">${
        node.attitude
      }</span>
        </div>`;
    } else {
      nodeInfo.innerHTML =
        '<div class="node-info">Click a node for details</div>';
    }
  }
};

export const showVictory = (playerId: number): void => {
  const modal = document.getElementById("victoryModal");
  const text = document.getElementById("victoryText");
  if (text) {
    text.innerHTML = `🏆 Player ${
      playerId + 1
    } Wins! 🏆<br>Controlled 60% of city influence!`;
  }
  if (modal) {
    modal.style.display = "block";
  }
};
