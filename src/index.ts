import { Game } from "./Game.js";
import { draw } from "./rendering.js";
import {
  handleClick,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
} from "./input.js";

export const canvas = document.getElementById(
  "gameCanvas"
) as HTMLCanvasElement;
export let game: Game | null = null;

window.onload = (): void => {
  const resizeCanvas = (): void => {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    if (game?.nodes && game.nodes.length > 0) {
      draw(game);
    }
  };

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  canvas.addEventListener("click", (e: MouseEvent) => handleClick(e, game));
  canvas.addEventListener("contextmenu", (e: MouseEvent) => {
    e.preventDefault();
    handleClick(e, game, true);
  });
  canvas.addEventListener("mousedown", (e: MouseEvent) =>
    handleMouseDown(e, game)
  );
  canvas.addEventListener("mousemove", (e: MouseEvent) =>
    handleMouseMove(e, game)
  );
  canvas.addEventListener("mouseup", (e: MouseEvent) => handleMouseUp(e, game));

  startNewGame();
};

function startNewGame(): void {
  game = new Game();

  const endTurnBtn = document.getElementById("endTurnBtn") as HTMLButtonElement;
  const newGameBtn = document.getElementById("newGameBtn") as HTMLButtonElement;
  const anewGameBtn = document.getElementById(
    "anewGameBtn"
  ) as HTMLButtonElement;

  if (endTurnBtn) {
    endTurnBtn.addEventListener("click", () => game?.nextTurn());
  }
  if (newGameBtn) {
    newGameBtn.addEventListener("click", () => game?.newGame());
  }
  if (anewGameBtn) {
    anewGameBtn.addEventListener("click", () => game?.newGame());
  }
}
