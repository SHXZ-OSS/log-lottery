<script setup lang="ts">
import type { IPersonConfig, IPrizeConfig } from '@/types/storeType'
import { ref, watch, computed, onUnmounted, nextTick } from 'vue'
import confetti from 'canvas-confetti'
import BlurText from '@/components/BlurText/index.vue'
import FadeContent from '@/components/FadeContent/index.vue'
import LightRays from '@/components/LightRays/index.vue'

interface Props {
    visible: boolean
    winners: IPersonConfig[]
    prize: IPrizeConfig | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
    (e: 'close'): void
}>()

const currentIndex = ref(0)
const isAnimating = ref(false)

let animationTimer: ReturnType<typeof setTimeout> | null = null
let audioRef: HTMLAudioElement | null = null

// 预加载音效
const preloadAudio = () => {
    audioRef = new Audio('/log-lottery/effect.mp3')
    audioRef.preload = 'auto'
}

// 播放音效
const playSound = () => {
    if (audioRef) {
        audioRef.currentTime = 0
        audioRef.play().catch((err) => {
            console.warn('音效播放失败:', err)
        })
    }
}

// 计算当前展示的内容
// 动画流程：
// 0: "恭喜中奖"
// 1: 奖项名称
// 2+: 每个中奖者 (每人2步: 部门/姓名)
const displayInfo = computed(() => {
    if (currentIndex.value === 0) {
        return { phase: 'intro' as const }
    }
    if (currentIndex.value === 1) {
        return { phase: 'prize' as const }
    }

    // 从第2步开始是选手展示，每人2步
    const winnerIdx = Math.floor((currentIndex.value - 2) / 2)
    const step = (currentIndex.value - 2) % 2

    if (winnerIdx >= props.winners.length) {
        return { phase: 'end' as const }
    }

    return {
        phase: 'winner' as const,
        winner: props.winners[winnerIdx],
        winnerIndex: winnerIdx,
        step,
    }
})

// 触发礼花效果 - 所有人都使用大量金色confetti
const fireConfetti = () => {
    const zIndex = 99999

    confetti({
        particleCount: 500,
        ticks: 100,
        spread: 100,
        origin: { y: 0.6, x: 0.5 },
        colors: ['#FFD700', '#FFFACD', '#FFA500'],
        zIndex,
    })
}

// 清理定时器
const clearTimers = () => {
    if (animationTimer) {
        clearTimeout(animationTimer)
        animationTimer = null
    }
}

// 下一步动画
const nextStep = () => {
    if (!props.visible || !isAnimating.value)
        return

    const info = displayInfo.value

    // 动画结束
    if (info.phase === 'end') {
        isAnimating.value = false
        emit('close')
        return
    }

    // 在展示姓名时（step === 1，因为现在只有2步）触发礼花和音效
    if (info.phase === 'winner' && info.step === 1) {
        fireConfetti()
        playSound()
    }

    // 设置下一步的定时器
    let delay = 2000
    if (info.phase === 'winner') {
        // 姓名展示后停留更长时间
        delay = info.step === 1 ? 4000 : 2500
    }
    animationTimer = setTimeout(() => {
        currentIndex.value++
        nextStep()
    }, delay)
}

// 开始动画
const startAnimation = () => {
    clearTimers()
    currentIndex.value = 0
    isAnimating.value = true

    // 预加载音效
    preloadAudio()

    nextTick(() => {
        // 初始延迟后开始动画
        animationTimer = setTimeout(() => {
            currentIndex.value++
            nextStep()
        }, 2000)
    })
}

// 监听 visible 变化
watch(() => props.visible, (visible) => {
    if (visible && props.winners.length > 0) {
        startAnimation()
    }
    else {
        clearTimers()
        isAnimating.value = false
    }
}, { immediate: true })

onUnmounted(() => {
    clearTimers()
    // 清理音效
    if (audioRef) {
        audioRef.pause()
        audioRef = null
    }
})
</script>

<template>
    <Teleport to="body">
        <Transition name="fade">
            <div
                v-if="visible && winners.length > 0"
                class="winner-showcase"
            >
                <!-- 光线特效背景层 - 固定金色 -->
                <div class="light-rays-bg">
                    <LightRays
                        rays-origin="top-center"
                        rays-color="#FFD700"
                        :light-spread="3"
                        :ray-length="4"
                        :saturation="2"
                        :follow-mouse="false"
                        :mouse-influence="0.1"
                        :fade-distance="1.5"
                        :noise-amount="0.1"
                    />
                </div>

                <!-- 步骤0: 恭喜中奖 -->
                <FadeContent
                    v-if="displayInfo.phase === 'intro'"
                    :blur="true"
                    :duration="800"
                    easing="ease-out"
                    :initial-opacity="0"
                >
                    <div class="showcase-title">
                        恭喜中奖
                    </div>
                </FadeContent>

                <!-- 步骤1: 奖项名称 -->
                <div v-else-if="displayInfo.phase === 'prize' && prize" class="showcase-title">
                    <BlurText
                        :key="`prize-${prize.id}`"
                        :text="prize.name"
                        :delay="200"
                        animate-by="words"
                        direction="top"
                    />
                </div>

                <!-- 步骤2+: 中奖者信息 (2行: 部门/姓名) -->
                <div v-else-if="displayInfo.phase === 'winner'" class="winner-info-container">
                    <!-- 第1行：部门 -->
                    <div class="info-row row-1">
                        <BlurText
                            v-if="displayInfo.step >= 0"
                            :key="`dept-${displayInfo.winnerIndex}`"
                            :text="displayInfo.winner.department || ''"
                            :delay="300"
                            animate-by="letters"
                            direction="top"
                        />
                    </div>

                    <!-- 第2行：姓名 -->
                    <div class="info-row row-2 name-row">
                        <BlurText
                            v-if="displayInfo.step >= 1"
                            :key="`name-${displayInfo.winnerIndex}`"
                            :text="displayInfo.winner.name"
                            :delay="400"
                            animate-by="letters"
                            direction="top"
                        />
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.winner-showcase {
    position: fixed;
    inset: 0;
    background: #000;
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    color: #fff;
    text-align: center;
    padding: 16px;
    cursor: default;
    user-select: none;
}

.light-rays-bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
}

.showcase-title {
    font-size: 20rem;
    font-weight: bold;
    color: #fff;
    z-index: 1;
}

.winner-info-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    color: #fff;
    height: 45rem;
    z-index: 1;
}

.info-row {
    position: absolute;
    width: 100%;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.row-1 {
    top: 0;
    height: 6rem;
    font-size: 4rem;
}

.row-2 {
    top: 8rem;
    height: 37rem;
}

.name-row {
    font-size: 35rem;
    line-height: 1;
    color: #FFD700;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

@media (max-width: 768px) {
    .showcase-title {
        font-size: 6rem;
    }

    .winner-info-container {
        height: 16rem;
    }

    .row-1 {
        height: 3rem;
        font-size: 1.5rem;
    }

    .row-2 {
        top: 4rem;
        height: 12rem;
    }

    .name-row {
        font-size: 10rem;
    }
}
</style>
