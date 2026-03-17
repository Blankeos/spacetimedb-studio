import { type Component, createEffect, createMemo, createSignal, For, type JSX, on, Show } from "solid-js"
import { fitView, getEdgePositions, layoutDAG } from "./layout"
import type { EdgeBase, FlowProps, NodeBase, Position } from "./types"
import "./flow.css"

function createFlow<N extends NodeBase, E extends EdgeBase>() {
  const EdgeRenderer: Component<{
    edge: E
    sourcePos: Position
    targetPos: Position
    selected: boolean
    onClick?: () => void
  }> = (props) => {
    const midX = () => (props.sourcePos.x + props.targetPos.x) / 2
    const midY = () => (props.sourcePos.y + props.targetPos.y) / 2

    const ctrl1Y = () => props.sourcePos.y + Math.abs(props.targetPos.y - props.sourcePos.y) * 0.5
    const ctrl2Y = () => props.targetPos.y - Math.abs(props.targetPos.y - props.sourcePos.y) * 0.5

    return (
      <g
        class="edge-group"
        role="button"
        tabindex={0}
        onClick={() => props.onClick?.()}
        onKeyDown={(e) => e.key === "Enter" && props.onClick?.()}
      >
        <path
          class={`edge-path ${props.selected ? "selected" : ""}`}
          d={`M ${props.sourcePos.x} ${props.sourcePos.y} C ${props.sourcePos.x} ${ctrl1Y()}, ${props.targetPos.x} ${ctrl2Y()}, ${props.targetPos.x} ${props.targetPos.y}`}
          fill="none"
          marker-end={props.selected ? "url(#arrow-selected)" : "url(#arrow)"}
        />
        {props.selected && (
          <g transform={`translate(${midX()}, ${midY()})`}>
            <circle r="10" class="edge-delete-circle" />
            <text text-anchor="middle" dominant-baseline="central" class="edge-delete-x">
              ×
            </text>
          </g>
        )}
      </g>
    )
  }

  const NodeRenderer: Component<{
    node: N
    selected: boolean
    onClick?: () => void
    onDragStart?: (e: MouseEvent) => void
  }> = (props) => {
    const data = () => props.node.data
    const columns = () =>
      (data().columns as Array<{
        name: string
        type: string
        primary?: boolean
      }>) || []

    return (
      <div
        class={`flow-node ${props.selected ? "selected" : ""}`}
        style={{
          transform: `translate(${props.node.position.x}px, ${props.node.position.y}px)`,
        }}
        role="button"
        tabindex={0}
        onClick={() => props.onClick?.()}
        onKeyDown={(e) => e.key === "Enter" && props.onClick?.()}
        onMouseDown={(e) => {
          e.stopPropagation()
          props.onDragStart?.(e)
        }}
      >
        <div class="node-header">
          <span class="node-type-icon">📋</span>
          <span class="node-title">{data().name as string}</span>
        </div>
        {columns().length > 0 && (
          <div class="node-columns">
            <For each={columns()}>
              {(col) => (
                <div class="node-column">
                  <span class="column-name">{col.name}</span>
                  <span class="column-type">{col.type}</span>
                  {col.primary && <span class="column-primary">PK</span>}
                </div>
              )}
            </For>
          </div>
        )}
      </div>
    )
  }

  return function Flow(props: FlowProps<N, E> & { children?: JSX.Element }) {
    const [selectedNode, setSelectedNode] = createSignal<string | null>(null)
    const [selectedEdge, setSelectedEdge] = createSignal<string | null>(null)
    const [transform, setTransform] = createSignal({ x: 50, y: 50, zoom: 1 })
    const [isPanning, setIsPanning] = createSignal(false)
    const [panStart, setPanStart] = createSignal({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = createSignal(false)
    const [dragNode, setDragNode] = createSignal<string | null>(null)
    const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 })

    const [nodePositions, setNodePositions] = createSignal<Map<string, Position>>(new Map())

    const [layoutedNodes, setLayoutedNodes] = createSignal<N[]>([])

    createEffect(
      on(
        () => [props.nodes, props.edges] as const,
        () => {
          if (props.nodes.length > 0) {
            const laid = layoutDAG(props.nodes, props.edges, { direction: "TB" })
            setLayoutedNodes(laid as N[])
            const positions = new Map<string, Position>()
            for (const n of laid) {
              positions.set(n.id, { ...n.position })
            }
            setNodePositions(positions)
          }
        },
        { defer: false }
      )
    )

    const nodesWithPositions = () => {
      const positions = nodePositions()
      return layoutedNodes().map((n) => ({
        ...n,
        position: positions.get(n.id) || n.position,
      }))
    }

    createEffect(
      on(layoutedNodes, (nodes) => {
        if (props.fitView && nodes.length > 0) {
          queueMicrotask(() => {
            const containerEl = document.querySelector(".flow-container")
            if (containerEl) {
              const rect = containerEl.getBoundingClientRect()
              const { offset, zoom } = fitView(nodes, rect.width, rect.height, 100)
              setTransform({ x: offset.x, y: offset.y, zoom })
            }
          })
        }
      })
    )

    const edgePositions = createMemo(() => {
      const positions: Map<string, { source: Position; target: Position }> = new Map()
      const nodes = nodesWithPositions()
      for (const edge of props.edges) {
        const pos = getEdgePositions(nodes, edge)
        if (pos) {
          positions.set(edge.id, {
            source: { x: pos.sourceX, y: pos.sourceY },
            target: { x: pos.targetX, y: pos.targetY },
          })
        }
      }
      return positions
    })

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (e.target === e.currentTarget || target.classList.contains("flow-background")) {
        setIsPanning(true)
        setPanStart({ x: e.clientX - transform().x, y: e.clientY - transform().y })
        setSelectedNode(null)
        setSelectedEdge(null)
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging() && dragNode()) {
        const zoom = transform().zoom
        const dx = e.clientX - dragOffset().x
        const dy = e.clientY - dragOffset().y

        setNodePositions((prev) => {
          const next = new Map(prev)
          const node = layoutedNodes().find((n) => n.id === dragNode())
          if (node) {
            next.set(dragNode()!, {
              x: (dx - transform().x) / zoom,
              y: (dy - transform().y) / zoom,
            })
          }
          return next
        })
      } else if (isPanning()) {
        setTransform((prev) => ({
          ...prev,
          x: e.clientX - panStart().x,
          y: e.clientY - panStart().y,
        }))
      }
    }

    const handleMouseUp = () => {
      setIsPanning(false)
      setIsDragging(false)
      setDragNode(null)
    }

    const handleNodeDragStart = (nodeId: string, e: MouseEvent) => {
      e.stopPropagation()
      setIsDragging(true)
      setDragNode(nodeId)
      const node = nodesWithPositions().find((n) => n.id === nodeId)
      if (node) {
        const zoom = transform().zoom
        setDragOffset({
          x: e.clientX - (node.position.x * zoom + transform().x),
          y: e.clientY - (node.position.y * zoom + transform().y),
        })
      }
      setSelectedNode(nodeId)
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setTransform((prev) => ({
        ...prev,
        zoom: Math.max(0.1, Math.min(3, prev.zoom * delta)),
      }))
    }

    return (
      <div
        class={`flow-container ${props.class || ""}`}
        role="application"
        aria-label="Schema diagram"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          class="flow-background"
          style={{
            transform: `translate(${transform().x}px, ${transform().y}px) scale(${transform().zoom})`,
          }}
        >
          <svg class="edges-layer">
            <defs>
              <marker
                id="arrow"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" class="edge-arrow-marker" />
              </marker>
              <marker
                id="arrow-selected"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" class="edge-arrow-marker selected" />
              </marker>
            </defs>
            <For each={props.edges}>
              {(edge) => {
                const pos = () => edgePositions().get(edge.id)
                return (
                  <Show when={pos()}>
                    {(p) => (
                      <EdgeRenderer
                        edge={edge}
                        sourcePos={p().source}
                        targetPos={p().target}
                        selected={selectedEdge() === edge.id}
                        onClick={() => {
                          setSelectedEdge(edge.id)
                          props.onEdgeClick?.(edge)
                        }}
                      />
                    )}
                  </Show>
                )
              }}
            </For>
          </svg>
          <div class="nodes-layer">
            <For each={nodesWithPositions()}>
              {(node) => (
                <NodeRenderer
                  node={node}
                  selected={selectedNode() === node.id}
                  onClick={() => {
                    setSelectedNode(node.id)
                    props.onNodeClick?.(node)
                  }}
                  onDragStart={(e) => handleNodeDragStart(node.id, e)}
                />
              )}
            </For>
          </div>
        </div>
      </div>
    )
  }
}

export { createFlow }
export type { EdgeBase, FlowProps, NodeBase, Position } from "./types"
