import {
  children,
  createComputed,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  splitProps,
  untrack,
} from "solid-js"
import makeTippy, { type Instance, type Props } from "tippy.js"

export interface TippyOptions {
  disabled?: boolean
  hidden?: boolean
  props?: Partial<Props>
}

export function tippy<T extends Element>(target: T, opts: () => TippyOptions | undefined): void {
  createEffect(() => {
    const options = opts()
    const instance = makeTippy(
      target,
      untrack(() => options?.props)
    )

    createComputed(() => {
      if (options?.disabled) {
        instance.disable()
      } else {
        instance.enable()
      }
    })

    createComputed(() => {
      if (options?.hidden) {
        instance.hide()
      } else {
        instance.show()
      }
    })

    createComputed(() => {
      instance.setProps({
        ...(options?.props ?? {}),
      })
    })

    onCleanup(() => {
      instance.destroy()
    })
  })
}

export function useTippy<T extends Element>(
  target: () => T | undefined | null,
  options?: TippyOptions
): () => Instance | undefined {
  const [current, setCurrent] = createSignal<Instance>()

  createEffect(() => {
    const currentTarget = target()
    if (currentTarget) {
      const instance = makeTippy(
        currentTarget,
        untrack(() => options?.props)
      )

      setCurrent(instance)

      createComputed(() => {
        if (options?.disabled) {
          instance.disable()
        } else {
          instance.enable()
        }
      })

      createComputed(() => {
        if (options?.hidden) {
          instance.hide()
        } else {
          instance.show()
        }
      })

      createComputed(() => {
        instance.setProps({
          ...(options?.props ?? {}),
        })
      })

      onCleanup(() => {
        instance.destroy()
      })
    }
  })

  return () => current()
}

type CustomTippyOptions = {
  disabled?: boolean
  hidden?: boolean
  open?: boolean
  content?: string | JSX.Element
  props?: Omit<Partial<Props>, "content">
}

export function Tippy(props: CustomTippyOptions & { children: JSX.Element }) {
  const [local, tippyProps] = splitProps(props, ["children", "content", "open"])

  const resolvedChildren = children(() => local.children)
  const [trigger, setTrigger] = createSignal<HTMLElement>()

  createEffect(() => {
    const child = resolvedChildren.toArray()[0]
    if (child instanceof HTMLElement) {
      setTrigger(child)
    }
  })

  const [contentContainer, setContentContainer] = createSignal<HTMLDivElement>()

  const getInstance = useTippy(trigger, {
    get disabled() {
      return tippyProps.disabled
    },
    get hidden() {
      if (local.open !== undefined) {
        return !local.open
      }
      return tippyProps.hidden ?? true
    },
    get props() {
      return {
        animation: "scale-subtle",
        theme: "custom",
        ...tippyProps.props,
        content: contentContainer(),
        ...(local.open !== undefined && { trigger: "manual", hideOnClick: false }),
      } satisfies TippyOptions["props"]
    },
  })

  // SolidJS updates content inside the container element in-place (fine-grained
  // reactivity), so local.content reference never changes. Use a MutationObserver
  // to detect DOM mutations and force Popper to recompute size/arrow position.
  createEffect(() => {
    const container = contentContainer()
    if (!container) return
    const observer = new MutationObserver(() => {
      getInstance()?.popperInstance?.update()
    })
    observer.observe(container, { childList: true, subtree: true, characterData: true })
    onCleanup(() => observer.disconnect())
  })

  return (
    <>
      {resolvedChildren()}
      <div style={{ display: "none" }}>
        <div ref={setContentContainer}>{local.content}</div>
      </div>
    </>
  )
}
