import { Node, PowerEdge } from "./types.js";

export const distance = (a: Node, b: Node): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

export const BFSfindPath = (
  from: number,
  to: number,
  edges: PowerEdge[],
  player: number
): boolean => {
  const graph: Record<number, number[]> = {};
  edges.forEach((e) => {
    if (e.owner !== player) return;
    graph[e.from] ??= [];
    graph[e.to] ??= [];
    graph[e.from].push(e.to);
    graph[e.to].push(e.from);
  });

  const visited = new Set([from]);
  const queue = [from];

  while (queue.length) {
    const current = queue.shift()!;
    if (current === to) return true;
    for (const n of graph[current] ?? []) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }
  return false;
};

export class UnionFind {
  private parent = new Map<number, number>();
  private rank = new Map<number, number>();

  constructor(ids: number[]) {
    ids.forEach((id) => {
      this.parent.set(id, id);
      this.rank.set(id, 0);
    });
  }

  find(x: number): number {
    const p = this.parent.get(x);
    if (p !== x) this.parent.set(x, this.find(p!));
    return this.parent.get(x)!;
  }

  union(x: number, y: number): boolean {
    const [rx, ry] = [this.find(x), this.find(y)];
    if (rx === ry) return false;

    if (this.rank.get(rx)! < this.rank.get(ry)!) {
      this.parent.set(rx, ry);
    } else {
      this.parent.set(ry, rx);
      if (this.rank.get(rx) === this.rank.get(ry)) {
        this.rank.set(rx, this.rank.get(rx)! + 1);
      }
    }
    return true;
  }
}

export const kruskalsMST = (nodes: Node[], nodeIds: number[]): PowerEdge[] => {
  const edges = nodeIds.flatMap((a, i) =>
    nodeIds.slice(i + 1).map((b) => ({
      from: a,
      to: b,
      weight: distance(nodes[a], nodes[b]),
    }))
  );

  edges.sort((a, b) => a.weight - b.weight);
  const uf = new UnionFind(nodeIds);
  const mst: PowerEdge[] = [];

  for (const { from, to } of edges) {
    if (uf.union(from, to)) {
      mst.push({
        from,
        to,
        currentFlow: 0,
        capacity: 50 + Math.floor(Math.random() * 50),
        owner: nodes[from].owner!,
      });
    }
  }

  return mst;
};

export const greedyClusterAssignment = (
  nodes: Node[],
  centers: Node[],
  isValid: (clusterId: number, node: Node) => boolean
): number[] =>
  nodes.map(
    (node) =>
      centers.reduce(
        (best, center, i) => {
          const penalty = isValid(i, node) ? 0 : 10000;
          const score = distance(node, center) + penalty;
          return score < best.score ? { index: i, score } : best;
        },
        { index: 0, score: Infinity }
      ).index
  );
