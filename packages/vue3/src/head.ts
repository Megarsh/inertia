import type { HeadManager } from '@inertiajs/core'
import { escape } from 'lodash-es'
import { defineComponent, DefineComponent, inject, onBeforeUnmount, VNode } from 'vue'

export type InertiaHead = DefineComponent<{
  title?: string
}>

const Head: InertiaHead = defineComponent({
  props: {
    title: {
      type: String,
      required: false,
    },
  },
  setup(props, { slots }) {
    const headManager = inject<HeadManager>('headManager')

    if (!headManager) {
      throw new Error(`<Head> component requires Inertia app context.`)
    }

    const provider = headManager.createProvider()

    function isUnaryTag(node: VNode) {
      return (
        typeof node.type === 'string' &&
        [
          'area',
          'base',
          'br',
          'col',
          'embed',
          'hr',
          'img',
          'input',
          'keygen',
          'link',
          'meta',
          'param',
          'source',
          'track',
          'wbr',
        ].indexOf(node.type) > -1
      )
    }

    function renderTagStart(node: VNode) {
      node.props = node.props || {}

      const props = node.props as Record<string, unknown>
      props['data-inertia'] = props['head-key'] !== undefined ? props['head-key'] : ''

      const attrs = Object.keys(props).reduce((carry, name) => {
        const value = String(props[name])

        if (['key', 'head-key'].includes(name)) {
          return carry
        } else if (value === '') {
          return carry + ` ${name}`
        } else {
          return carry + ` ${name}="${escape(value)}"`
        }
      }, '')

      return `<${String(node.type)}${attrs}>`
    }

    function renderTagChildren(node: VNode): string {
      const { children } = node

      if (typeof children === 'string') {
        return children
      }

      if (Array.isArray(children)) {
        return children.reduce<string>((html, child) => {
          return html + renderTag(child as VNode)
        }, '')
      }

      return ''
    }

    function isFunctionNode(node: VNode): node is VNode & { type: () => VNode } {
      return typeof node.type === 'function'
    }

    function isComponentNode(node: VNode): node is VNode & { type: object } {
      return typeof node.type === 'object'
    }

    function isCommentNode(node: VNode) {
      return /(comment|cmt)/i.test(node.type.toString())
    }

    function isFragmentNode(node: VNode) {
      return /(fragment|fgt|symbol\(\))/i.test(node.type.toString())
    }

    function isTextNode(node: VNode) {
      return /(text|txt)/i.test(node.type.toString())
    }

    function renderTag(node: VNode): string {
      if (isTextNode(node)) {
        return String(node.children)
      } else if (isFragmentNode(node)) {
        return ''
      } else if (isCommentNode(node)) {
        return ''
      }

      let html = renderTagStart(node)

      if (node.children) {
        html += renderTagChildren(node)
      }

      if (!isUnaryTag(node)) {
        html += `</${String(node.type)}>`
      }

      return html
    }

    function addTitleElement(elements: string[]) {
      if (props.title && !elements.find((tag) => tag.startsWith('<title'))) {
        elements.push(`<title data-inertia="">${props.title}</title>`)
      }

      return elements
    }

    function renderNodes(nodes: VNode[]) {
      const elements = nodes
        .flatMap((node) => resolveNode(node))
        .map((node) => renderTag(node))
        .filter((node) => node)

      return addTitleElement(elements)
    }

    function resolveNode(node: VNode): VNode | VNode[] {
      if (isFunctionNode(node)) {
        return resolveNode(node.type())
      } else if (isComponentNode(node)) {
        console.warn(`Using components in the <Head> component is not supported.`)
        return []
      } else if (isTextNode(node) && node.children) {
        return node
      } else if (isFragmentNode(node) && node.children) {
        return (node.children as VNode[]).flatMap((child) => resolveNode(child))
      } else if (isCommentNode(node)) {
        return []
      } else {
        return node
      }
    }

    onBeforeUnmount(() => {
      provider.disconnect()
    })

    return () => {
      provider.update(renderNodes(slots.default ? slots.default() : []))
    }
  },
})

export default Head
