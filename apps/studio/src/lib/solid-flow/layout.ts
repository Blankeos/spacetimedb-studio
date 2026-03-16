import type { EdgeBase, NodeBase, Position } from "./types"

interface LayoutNode extends NodeBase {
  _depth?: number
  _visited?: boolean
}

function getNodeDimensions(node: NodeBase): { width: number; height: number } {
  const content = node.data
  const columns = (content.columns as Array<{ name: string; type: string }>) || []
  const lineCount = 3 + columns.length
  const height = Math.max(80, lineCount * 20 + 16)
  const nameLen = (content.name as string)?.length || 10
  const width = Math.max(160, Math.min(350, nameLen * 10 + 40))
  return { width, height }
}

export function layoutDAG<N extends NodeBase, E extends EdgeBase>(
  nodes: N[],
  edges: E[],
  options?: {
    nodeWidth?: number
    nodeHeight?: number
    horizontalSpacing?: number
    verticalSpacing?: number
    direction?: "LR" | "TB"
  }
): N[] {
  const { horizontalSpacing = 300, verticalSpacing = 100, direction = "TB" } = options || {}

  if (nodes.length === 0) return nodes

  const nodeMap = new Map<string, LayoutNode>()
  for (const n of nodes) {
    nodeMap.set(n.id, { ...n, _depth: 0, _visited: false })
  }

  const inDegree = new Map<string, number>()
  const outEdges = new Map<string, string[]>()

  nodes.forEach((n) => {
    inDegree.set(n.id, 0)
    outEdges.set(n.id, [])
  })

  for (const e of edges) {
    const current = inDegree.get(e.target) || 0
    inDegree.set(e.target, current + 1)
    const outs = outEdges.get(e.source) || []
    outs.push(e.target)
    outEdges.set(e.source, outs)
  }

  const levelBuckets = new Map<number, string[]>()

  function assignLevels(nodeId: string, level: number) {
    const node = nodeMap.get(nodeId)
    if (!node) return

    if (node._visited && (node._depth ?? 0) >= level) return

    node._visited = true
    node._depth = level

    const bucket = levelBuckets.get(level) || []
    if (!bucket.includes(nodeId)) {
      bucket.push(nodeId)
      levelBuckets.set(level, bucket)
    }

    const outs = outEdges.get(nodeId) || []
    for (const targetId of outs) {
      assignLevels(targetId, level + 1)
    }
  }

  nodes.forEach((n) => {
    if ((inDegree.get(n.id) || 0) === 0) {
      assignLevels(n.id, 0)
    }
  })

  nodeMap.forEach((node, id) => {
    if (!node._visited) {
      assignLevels(id, 0)
    }
  })

  const maxLevel = Math.max(...Array.from(levelBuckets.keys()), 0)

  const levelCounts = new Map<number, number>()
  const levelIndices = new Map<string, number>()

  for (let level = 0; level <= maxLevel; level++) {
    const bucket = levelBuckets.get(level) || []
    levelCounts.set(level, 0)
    bucket.forEach((nodeId) => {
      levelIndices.set(nodeId, levelCounts.get(level) || 0)
      levelCounts.set(level, (levelCounts.get(level) || 0) + 1)
    })
  }

  const result = nodes.map((node) => {
    const depth = nodeMap.get(node.id)?._depth ?? 0
    const index = levelIndices.get(node.id) ?? 0
    const totalInLevel = levelCounts.get(depth) || 1
    const dims = getNodeDimensions(node)

    const ySpacing = verticalSpacing + dims.height

    if (direction === "LR") {
      return {
        ...node,
        position: {
          x: depth * horizontalSpacing,
          y: index * ySpacing - ((totalInLevel - 1) * ySpacing) / 2,
        },
      }
    }

    return {
      ...node,
      position: {
        x: index * ySpacing - ((totalInLevel - 1) * ySpacing) / 2,
        y: depth * (horizontalSpacing * 0.8),
      },
    }
  })

  return result
}

export function getEdgePositions<N extends NodeBase, E extends EdgeBase>(
  nodes: N[],
  edge: E,
  nodeWidth = 180,
  nodeHeight = 100
): { sourceX: number; sourceY: number; targetX: number; targetY: number } | null {
  const sourceNode = nodes.find((n) => n.id === edge.source)
  const targetNode = nodes.find((n) => n.id === edge.target)

  if (!sourceNode || !targetNode) return null

  const dims = getNodeDimensions(sourceNode)
  const targetDims = getNodeDimensions(targetNode)

  return {
    sourceX: sourceNode.position.x + (dims.width || nodeWidth) / 2,
    sourceY: sourceNode.position.y + (dims.height || nodeHeight),
    targetX: targetNode.position.x + (targetDims.width || nodeWidth) / 2,
    targetY: targetNode.position.y,
  }
}

export function fitView<N extends NodeBase>(
  nodes: N[],
  containerWidth: number,
  containerHeight: number,
  padding = 50
): { offset: Position; zoom: number } {
  if (nodes.length === 0) {
    return { offset: { x: 0, y: 0 }, zoom: 1 }
  }

  let minX = Infinity,
    minY = Infinity
  let maxX = -Infinity,
    maxY = -Infinity

  nodes.forEach((node) => {
    const dims = getNodeDimensions(node)
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + dims.width)
    maxY = Math.max(maxY, node.position.y + dims.height)
  })

  const contentWidth = maxX - minX
  const contentHeight = maxY - minY

  const scaleX = (containerWidth - padding * 2) / contentWidth
  const scaleY = (containerHeight - padding * 2) / contentHeight
  const zoom = Math.min(scaleX, scaleY, 1)

  const centerX = minX + contentWidth / 2
  const centerY = minY + contentHeight / 2

  const offsetX = containerWidth / 2 - centerX * zoom
  const offsetY = containerHeight / 2 - centerY * zoom

  return { offset: { x: offsetX, y: offsetY }, zoom }
}
