export interface Position {
  x: number
  y: number
}

export interface NodeBase {
  id: string
  position: Position
  type?: string
  data: Record<string, unknown>
}

export interface EdgeBase {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface FlowProps<N extends NodeBase = NodeBase, E extends EdgeBase = EdgeBase> {
  nodes: N[]
  edges: E[]
  onNodeClick?: (node: N) => void
  onEdgeClick?: (edge: E) => void
  class?: string
  minZoom?: number
  maxZoom?: number
  fitView?: boolean
}

export interface NodeProps<N extends NodeBase = NodeBase> {
  node: N
  selected: boolean
  onClick?: () => void
}

export interface EdgeProps<E extends EdgeBase = EdgeBase> {
  edge: E
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  selected: boolean
  onClick?: () => void
}
