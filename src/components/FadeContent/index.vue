<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

interface Props {
    blur?: boolean
    duration?: number
    easing?: string
    delay?: number
    threshold?: number
    initialOpacity?: number
    className?: string
}

const props = withDefaults(defineProps<Props>(), {
    blur: false,
    duration: 1000,
    easing: 'ease-out',
    delay: 0,
    threshold: 0.1,
    initialOpacity: 0,
    className: '',
})

const containerRef = ref<HTMLElement | null>(null)
const inView = ref(false)

const triggerAnimation = () => {
    setTimeout(() => {
        inView.value = true
    }, props.delay)
}

onMounted(() => {
    // 直接触发动画，不使用 IntersectionObserver
    // 因为组件已经在可视区域内
    triggerAnimation()
})

// 如果需要重置动画
watch(() => props.delay, () => {
    inView.value = false
    triggerAnimation()
})
</script>

<template>
    <div
        ref="containerRef"
        :class="['fade-content', className]"
        :style="{
            opacity: inView ? 1 : initialOpacity,
            transition: `opacity ${duration}ms ${easing}, filter ${duration}ms ${easing}`,
            filter: blur ? (inView ? 'blur(0px)' : 'blur(10px)') : 'none',
        }"
    >
        <slot />
    </div>
</template>

<style scoped>
.fade-content {
    will-change: opacity, filter;
}
</style>
