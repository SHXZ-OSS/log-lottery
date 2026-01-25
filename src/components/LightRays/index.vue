<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Renderer, Program, Triangle, Mesh } from 'ogl'

export type RaysOrigin =
    | 'top-center'
    | 'top-left'
    | 'top-right'
    | 'right'
    | 'left'
    | 'bottom-center'
    | 'bottom-right'
    | 'bottom-left'

interface Props {
    raysOrigin?: RaysOrigin
    raysColor?: string
    raysSpeed?: number
    lightSpread?: number
    rayLength?: number
    pulsating?: boolean
    fadeDistance?: number
    saturation?: number
    followMouse?: boolean
    mouseInfluence?: number
    noiseAmount?: number
    distortion?: number
    className?: string
}

const props = withDefaults(defineProps<Props>(), {
    raysOrigin: 'top-center',
    raysColor: '#ffffff',
    raysSpeed: 1,
    lightSpread: 1,
    rayLength: 2,
    pulsating: false,
    fadeDistance: 1.0,
    saturation: 1.0,
    followMouse: true,
    mouseInfluence: 0.1,
    noiseAmount: 0.0,
    distortion: 0.0,
    className: '',
})

const containerRef = ref<HTMLDivElement | null>(null)
const isVisible = ref(false)

let renderer: Renderer | null = null
let uniformsRef: any = null
let animationIdRef: number | null = null
let meshRef: Mesh | null = null
let cleanupFunction: (() => void) | null = null

const mouseRef = { x: 0.5, y: 0.5 }
const smoothMouseRef = { x: 0.5, y: 0.5 }

// Color transition state
let currentColor: [number, number, number] = [1, 1, 1]
let targetColor: [number, number, number] = [1, 1, 1]
let startColor: [number, number, number] = [1, 1, 1]
const colorTransition = {
    isTransitioning: false,
    startTime: 0,
    duration: 500,
}

const hexToRgb = (hex: string): [number, number, number] => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return m
        ? [
                Number.parseInt(m[1], 16) / 255,
                Number.parseInt(m[2], 16) / 255,
                Number.parseInt(m[3], 16) / 255,
            ]
        : [1, 1, 1]
}

const lerp = (start: number, end: number, progress: number): number => {
    return start + (end - start) * progress
}

const lerpColor = (
    start: [number, number, number],
    end: [number, number, number],
    progress: number,
): [number, number, number] => {
    return [
        lerp(start[0], end[0], progress),
        lerp(start[1], end[1], progress),
        lerp(start[2], end[2], progress),
    ]
}

const getAnchorAndDir = (
    origin: RaysOrigin,
    w: number,
    h: number,
): { anchor: [number, number], dir: [number, number] } => {
    const outside = 0.2
    switch (origin) {
        case 'top-left':
            return { anchor: [0, -outside * h], dir: [0, 1] }
        case 'top-right':
            return { anchor: [w, -outside * h], dir: [0, 1] }
        case 'left':
            return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] }
        case 'right':
            return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] }
        case 'bottom-left':
            return { anchor: [0, (1 + outside) * h], dir: [0, -1] }
        case 'bottom-center':
            return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] }
        case 'bottom-right':
            return { anchor: [w, (1 + outside) * h], dir: [0, -1] }
        default: // "top-center"
            return { anchor: [0.5 * w, -outside * h], dir: [0, 1] }
    }
}

const initializeWebGL = async () => {
    if (!containerRef.value)
        return

    await new Promise(resolve => setTimeout(resolve, 10))

    if (!containerRef.value)
        return

    renderer = new Renderer({
        dpr: Math.min(window.devicePixelRatio, 2),
        alpha: true,
    })

    const gl = renderer.gl
    gl.canvas.style.width = '100%'
    gl.canvas.style.height = '100%'

    while (containerRef.value.firstChild) {
        containerRef.value.removeChild(containerRef.value.firstChild)
    }
    containerRef.value.appendChild(gl.canvas)

    const vert = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`

    const frag = `precision highp float;

uniform float iTime;
uniform vec2  iResolution;

uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;

varying vec2 vUv;

float noise(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                  float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  vec2 dirNorm = normalize(sourceToCoord);
  float cosAngle = dot(dirNorm, rayRefDirection);

  float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;

  float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));

  float distance = length(sourceToCoord);
  float maxDistance = iResolution.x * rayLength;
  float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);

  float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;

  float baseStrength = clamp(
    (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
    0.0, 1.0
  );

  return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);

  vec2 finalRayDir = rayDir;
  if (mouseInfluence > 0.0) {
    vec2 mouseScreenPos = mousePos * iResolution.xy;
    vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
    finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
  }

  vec4 rays1 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349,
                           1.5 * raysSpeed);
  vec4 rays2 = vec4(1.0) *
               rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234,
                           1.1 * raysSpeed);

  fragColor = rays1 * 0.5 + rays2 * 0.4;

  if (noiseAmount > 0.0) {
    float n = noise(coord * 0.01 + iTime * 0.1);
    fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
  }

  float brightness = 1.0 - (coord.y / iResolution.y);
  fragColor.x *= 0.1 + brightness * 0.8;
  fragColor.y *= 0.3 + brightness * 0.6;
  fragColor.z *= 0.5 + brightness * 0.5;

  if (saturation != 1.0) {
    float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
    fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
  }

  fragColor.rgb *= raysColor;
}

void main() {
  vec4 color;
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor  = color;
}`

    currentColor = hexToRgb(props.raysColor)
    targetColor = hexToRgb(props.raysColor)
    startColor = hexToRgb(props.raysColor)

    const uniforms = {
        iTime: { value: 0 },
        iResolution: { value: [1, 1] },
        rayPos: { value: [0, 0] },
        rayDir: { value: [0, 1] },
        raysColor: { value: currentColor },
        raysSpeed: { value: props.raysSpeed },
        lightSpread: { value: props.lightSpread },
        rayLength: { value: props.rayLength },
        pulsating: { value: props.pulsating ? 1.0 : 0.0 },
        fadeDistance: { value: props.fadeDistance },
        saturation: { value: props.saturation },
        mousePos: { value: [0.5, 0.5] },
        mouseInfluence: { value: props.mouseInfluence },
        noiseAmount: { value: props.noiseAmount },
        distortion: { value: props.distortion },
    }
    uniformsRef = uniforms

    const geometry = new Triangle(gl)
    const program = new Program(gl, {
        vertex: vert,
        fragment: frag,
        uniforms,
    })
    const mesh = new Mesh(gl, { geometry, program })
    meshRef = mesh

    const updatePlacement = () => {
        if (!containerRef.value || !renderer)
            return

        renderer.dpr = Math.min(window.devicePixelRatio, 2)

        const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.value
        renderer.setSize(wCSS, hCSS)

        const dpr = renderer.dpr
        const w = wCSS * dpr
        const h = hCSS * dpr

        uniforms.iResolution.value = [w, h]

        const { anchor, dir } = getAnchorAndDir(props.raysOrigin, w, h)
        uniforms.rayPos.value = anchor
        uniforms.rayDir.value = dir
    }

    const loop = (t: number) => {
        if (!renderer || !uniformsRef || !meshRef) {
            return
        }

        uniforms.iTime.value = t * 0.001

        // Handle color transition
        if (colorTransition.isTransitioning) {
            const elapsed = t - colorTransition.startTime
            const progress = Math.min(elapsed / colorTransition.duration, 1)

            const easedProgress = progress < 0.5
                ? 2 * progress * progress
                : 1 - (-2 * progress + 2) ** 2 / 2

            const interpolatedColor = lerpColor(startColor, targetColor, easedProgress)

            currentColor = interpolatedColor
            uniforms.raysColor.value = interpolatedColor

            if (progress >= 1) {
                colorTransition.isTransitioning = false
                currentColor = targetColor
                startColor = targetColor
            }
        }

        if (props.followMouse && props.mouseInfluence > 0.0) {
            const smoothing = 0.92

            smoothMouseRef.x = smoothMouseRef.x * smoothing + mouseRef.x * (1 - smoothing)
            smoothMouseRef.y = smoothMouseRef.y * smoothing + mouseRef.y * (1 - smoothing)

            uniforms.mousePos.value = [smoothMouseRef.x, smoothMouseRef.y]
        }

        try {
            renderer.render({ scene: mesh })
            animationIdRef = requestAnimationFrame(loop)
        }
        catch (error) {
            console.warn('WebGL rendering error:', error)
        }
    }

    window.addEventListener('resize', updatePlacement)
    updatePlacement()
    animationIdRef = requestAnimationFrame(loop)

    cleanupFunction = () => {
        if (animationIdRef) {
            cancelAnimationFrame(animationIdRef)
            animationIdRef = null
        }

        window.removeEventListener('resize', updatePlacement)

        if (renderer) {
            try {
                const canvas = renderer.gl.canvas
                const loseContextExt = renderer.gl.getExtension('WEBGL_lose_context')
                if (loseContextExt) {
                    loseContextExt.loseContext()
                }

                if (canvas && canvas.parentNode) {
                    canvas.parentNode.removeChild(canvas)
                }
            }
            catch (error) {
                console.warn('Error during WebGL cleanup:', error)
            }
        }

        renderer = null
        uniformsRef = null
        meshRef = null
    }
}

const handleMouseMove = (e: MouseEvent) => {
    if (!containerRef.value || !renderer)
        return
    const rect = containerRef.value.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    mouseRef.x = x
    mouseRef.y = y
}

onMounted(() => {
    if (!containerRef.value)
        return

    // 直接设置为可见并初始化 WebGL
    isVisible.value = true
    initializeWebGL()

    if (props.followMouse) {
        window.addEventListener('mousemove', handleMouseMove)
    }
})

onUnmounted(() => {
    if (cleanupFunction) {
        cleanupFunction()
        cleanupFunction = null
    }

    window.removeEventListener('mousemove', handleMouseMove)
})


// Watch for color changes
watch(() => props.raysColor, (newColor) => {
    const newTargetColor = hexToRgb(newColor)

    if (
        targetColor[0] !== newTargetColor[0]
        || targetColor[1] !== newTargetColor[1]
        || targetColor[2] !== newTargetColor[2]
    ) {
        startColor = [...currentColor] as [number, number, number]
        targetColor = newTargetColor
        colorTransition.isTransitioning = true
        colorTransition.startTime = performance.now()
        colorTransition.duration = 500
    }
})

// Watch for other prop changes
watch([
    () => props.raysSpeed,
    () => props.lightSpread,
    () => props.rayLength,
    () => props.pulsating,
    () => props.fadeDistance,
    () => props.saturation,
    () => props.mouseInfluence,
    () => props.noiseAmount,
    () => props.distortion,
    () => props.raysOrigin,
], () => {
    if (!uniformsRef || !containerRef.value || !renderer)
        return

    const u = uniformsRef

    u.raysSpeed.value = props.raysSpeed
    u.lightSpread.value = props.lightSpread
    u.rayLength.value = props.rayLength
    u.pulsating.value = props.pulsating ? 1.0 : 0.0
    u.fadeDistance.value = props.fadeDistance
    u.saturation.value = props.saturation
    u.mouseInfluence.value = props.mouseInfluence
    u.noiseAmount.value = props.noiseAmount
    u.distortion.value = props.distortion

    const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.value
    const dpr = renderer.dpr
    const { anchor, dir } = getAnchorAndDir(props.raysOrigin, wCSS * dpr, hCSS * dpr)
    u.rayPos.value = anchor
    u.rayDir.value = dir
})
</script>

<template>
    <div
        ref="containerRef"
        :class="['light-rays-container', className]"
    />
</template>

<style scoped>
.light-rays-container {
    width: 100%;
    height: 100%;
    position: relative;
    pointer-events: none;
    z-index: 3;
    overflow: hidden;
}
</style>
