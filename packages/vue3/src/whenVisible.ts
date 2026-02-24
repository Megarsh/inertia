import { ReloadOptions, router } from '@inertiajs/core'
import { computed, defineComponent, h, nextTick, onMounted, onUnmounted, PropType, ref, SlotsType, watch } from 'vue'
import { usePage } from './app'

export default defineComponent({
  name: 'WhenVisible',
  slots: Object as SlotsType<{
    default: { fetching: boolean }
    fallback: {}
  }>,
  props: {
    data: {
      type: [String, Array<String>],
    },
    params: {
      type: Object as PropType<ReloadOptions>,
    },
    buffer: {
      type: Number,
      default: 0,
    },
    as: {
      type: String,
      default: 'div',
    },
    always: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, { slots }) {
    const loaded = ref(false)
    const fetching = ref(false)
    const observer = ref<IntersectionObserver | null>(null)
    const triggerRef = ref<Element | null>(null)
    const keys = computed<string[]>(() =>
      props.data ? ((Array.isArray(props.data) ? props.data : [props.data]) as string[]) : [],
    )

    const page = usePage()

    function getReloadParams(): Partial<ReloadOptions> {
      const reloadParams: Partial<ReloadOptions> = { preserveErrors: true, ...props.params }

      if (props.data) {
        reloadParams.only = (Array.isArray(props.data) ? props.data : [props.data]) as string[]
      }

      return reloadParams
    }

    function prepareRegistration() {
      const exists = keys.value.length > 0 && keys.value.every((key) => page.props[key] !== undefined)
      loaded.value = exists

      if (exists && !props.always) {
        return
      }

      if (!observer.value || !exists) {
        nextTick(registerObserver)
      }
    }

    function registerObserver() {
      if (!props.always && loaded.value) {
        return
      }

      if (!triggerRef.value) {
        return
      }

      observer.value?.disconnect()

      observer.value = new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting) {
            return
          }

          if (fetching.value) {
            return
          }

          if (!props.always && loaded.value) {
            return
          }

          fetching.value = true

          const reloadParams = getReloadParams()

          router.reload({
            ...reloadParams,
            onStart: (e) => {
              fetching.value = true
              reloadParams.onStart?.(e)
            },
            onFinish: (e) => {
              loaded.value = true
              fetching.value = false
              reloadParams.onFinish?.(e)

              if (!props.always) {
                observer.value?.disconnect()
              }
            },
          })
        },
        {
          rootMargin: `${props.buffer}px`,
        },
      )

      observer.value.observe(triggerRef.value)
    }

    watch(
      () => keys.value.map((key) => page.props[key]),
      () => {
        prepareRegistration()
      },
    )

    onMounted(() => {
      prepareRegistration()
    })

    onUnmounted(() => {
      observer.value?.disconnect()
    })

    return () => {
      const els = []

      if (props.always || !loaded.value) {
        els.push(h(props.as, { ref: triggerRef }))
      }

      if (!loaded.value) {
        els.push(slots.fallback ? slots.fallback({}) : null)
      } else if (slots.default) {
        els.push(slots.default({ fetching: fetching.value }))
      }

      return els
    }
  },
})
