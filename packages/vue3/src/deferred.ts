import { isSameUrlWithoutQueryOrHash, router } from '@inertiajs/core'
import { defineComponent, onMounted, onUnmounted, ref, type SlotsType } from 'vue'
import { usePage } from './app'

const keysAreBeingReloaded = (only: string[], except: string[], keys: string[]): boolean => {
  if (only.length === 0 && except.length === 0) {
    return true
  }

  if (only.length > 0) {
    return keys.some((key) => only.includes(key))
  }

  return keys.some((key) => !except.includes(key))
}

export default defineComponent({
  name: 'Deferred',
  props: {
    data: {
      type: [String, Array<String>],
      required: true,
    },
  },
  slots: Object as SlotsType<{
    default: { reloading: boolean }
    fallback: {}
  }>,
  setup(props, { slots }) {
    const page = usePage()
    const reloading = ref(false)
    const activeReloads = new Set<object>()

    let removeStartListener: (() => void) | null = null
    let removeFinishListener: (() => void) | null = null

    function resolveKeys() {
      return (Array.isArray(props.data) ? props.data : [props.data]) as string[]
    }

    onMounted(() => {
      removeStartListener = router.on('start', (e) => {
        const visit = e.detail.visit

        if (
          visit.preserveState === true &&
          isSameUrlWithoutQueryOrHash(visit.url, window.location) &&
          keysAreBeingReloaded(visit.only, visit.except, resolveKeys())
        ) {
          activeReloads.add(visit)
          reloading.value = true
        }
      })

      removeFinishListener = router.on('finish', (e) => {
        const visit = e.detail.visit

        if (activeReloads.has(visit)) {
          activeReloads.delete(visit)
          reloading.value = activeReloads.size > 0
        }
      })
    })

    onUnmounted(() => {
      removeStartListener?.()
      removeFinishListener?.()
      activeReloads.clear()
    })

    return () => {
      if (!slots.fallback) {
        throw new Error('`<Deferred>` requires a `<template #fallback>` slot')
      }

      return resolveKeys().every((key) => page.props[key] !== undefined)
        ? slots.default?.({ reloading: reloading.value })
        : slots.fallback({})
    }
  },
})
