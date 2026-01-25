<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import gsap from 'gsap'

interface Props {
    text?: string
    delay?: number
    animateBy?: 'words' | 'letters'
    direction?: 'top' | 'bottom'
    className?: string
    onAnimationComplete?: () => void
    stepDuration?: number
}

const props = withDefaults(defineProps<Props>(), {
    text: '',
    delay: 180,
    animateBy: 'words',
    direction: 'top',
    className: '',
    stepDuration: 0.8,
})

const emit = defineEmits<{
    (e: 'animationComplete'): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const animationKey = ref(0)

const elements = computed(() => {
    if (!props.text)
        return []
    return props.animateBy === 'words'
        ? props.text.split(' ')
        : props.text.split('')
})

const runAnimation = () => {
    if (!containerRef.value)
        return

    const spans = containerRef.value.querySelectorAll('.blur-text-span')
    if (spans.length === 0)
        return

    const yFrom = props.direction === 'top' ? -50 : 50

    // 先重置所有元素的状态
    gsap.set(spans, {
        opacity: 0,
        y: yFrom,
        filter: 'blur(10px)',
    })

    // 然后执行动画
    spans.forEach((span, index) => {
        gsap.to(span, {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: props.stepDuration * 2,
            delay: (index * props.delay) / 1000,
            ease: 'power2.out',
            onComplete: () => {
                if (index === spans.length - 1) {
                    emit('animationComplete')
                    props.onAnimationComplete?.()
                }
            },
        })
    })
}

onMounted(() => {
    nextTick(() => {
        runAnimation()
    })
})

// 当 text 或 key 改变时重新动画
watch([() => props.text, animationKey], () => {
    nextTick(() => {
        runAnimation()
    })
}, { flush: 'post' })
</script>

<template>
    <p
        ref="containerRef"
        :class="['blur-text-container', className]"
    >
        <span
            v-for="(segment, index) in elements"
            :key="`${segment}-${index}-${animationKey}`"
            class="blur-text-span"
        >
            {{ segment === ' ' ? '\u00A0' : segment }}{{ animateBy === 'words' && index < elements.length - 1 ? '\u00A0' : '' }}
        </span>
    </p>
</template>

<style scoped>
.blur-text-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    margin: 0;
}

.blur-text-span {
    display: inline-block;
    opacity: 0;
    will-change: transform, filter, opacity;
}
</style>
