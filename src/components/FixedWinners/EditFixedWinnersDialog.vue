<script setup lang="ts">
import type { FixedWinnerItem, IPersonConfig, IPrizeConfig } from '@/types/storeType'
import { X } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import useStore from '@/store'

const props = defineProps<{
    prize: IPrizeConfig | null
}>()

const emit = defineEmits<{
    (e: 'submit-data', value: { enable: boolean, list: FixedWinnerItem[] }): void
}>()

const { t } = useI18n()
const personConfig = useStore().personConfig
const { getAllPersonList: allPersonList } = storeToRefs(personConfig)

const dialogRef = ref<HTMLDialogElement>()
const enable = ref(false)
const fixedList = ref<FixedWinnerItem[]>([])
const selectedPersonUuid = ref('')
const selectedPosition = ref<number | undefined>(undefined)
const searchText = ref('')
const showDropdown = ref(false)

// 获取可选人员列表（排除已添加的内定人员）
const availablePersonList = computed(() => {
    const fixedUuids = new Set(fixedList.value.map(f => f.uuid))
    return allPersonList.value.filter(p => !fixedUuids.has(p.uuid))
})

// 根据搜索文本过滤人员列表
const filteredPersonList = computed(() => {
    if (!searchText.value.trim()) {
        return availablePersonList.value
    }
    const keyword = searchText.value.toLowerCase().trim()
    return availablePersonList.value.filter(p =>
        (p.name && p.name.toLowerCase().includes(keyword))
        || (p.department && p.department.toLowerCase().includes(keyword))
        || (p.uid && p.uid.toLowerCase().includes(keyword)),
    )
})

// 位置选项（1 到奖项人数）
const positionOptions = computed(() => {
    if (!props.prize)
        return []
    const options: { value: number | undefined, label: string }[] = [
        { value: undefined, label: t('table.noPosition') },
    ]
    for (let i = 1; i <= props.prize.count; i++) {
        options.push({ value: i, label: `${i}` })
    }
    return options
})

// 已使用的位置
const usedPositions = computed(() => {
    return new Set(fixedList.value.filter(f => f.position).map(f => f.position))
})

// 监听 prize 变化，打开对话框
watch(() => props.prize, (newPrize) => {
    if (newPrize) {
        enable.value = newPrize.fixedWinners?.enable ?? false
        fixedList.value = [...(newPrize.fixedWinners?.list ?? [])]
        selectedPersonUuid.value = ''
        selectedPosition.value = undefined
        searchText.value = ''
        showDropdown.value = false
        dialogRef.value?.showModal()
    }
})

function selectPerson(person: IPersonConfig) {
    selectedPersonUuid.value = person.uuid
    searchText.value = `${person.name} (${person.department})`
    showDropdown.value = false
}

function addFixedWinner() {
    if (!selectedPersonUuid.value)
        return

    const person = allPersonList.value.find(p => p.uuid === selectedPersonUuid.value)
    if (!person)
        return

    // 检查位置是否已被占用
    if (selectedPosition.value && usedPositions.value.has(selectedPosition.value)) {
        return
    }

    fixedList.value.push({
        uuid: person.uuid,
        name: person.name,
        position: selectedPosition.value,
    })

    selectedPersonUuid.value = ''
    selectedPosition.value = undefined
    searchText.value = ''
    showDropdown.value = false
}

function handleSearchInput() {
    selectedPersonUuid.value = ''
    showDropdown.value = true
}

function handleSearchFocus() {
    showDropdown.value = true
}

function handleSearchBlur() {
    // 延迟关闭以允许点击下拉项
    setTimeout(() => {
        showDropdown.value = false
    }, 200)
}

function removeFixedWinner(index: number) {
    fixedList.value.splice(index, 1)
}

function updatePosition(index: number, position: number | undefined) {
    // 检查位置是否已被其他人占用
    if (position && usedPositions.value.has(position)) {
        // 如果已被占用，找到占用者并清除其位置
        const existingIndex = fixedList.value.findIndex(f => f.position === position)
        if (existingIndex !== -1 && existingIndex !== index) {
            fixedList.value[existingIndex].position = undefined
        }
    }
    fixedList.value[index].position = position
}

function handleSubmit() {
    emit('submit-data', {
        enable: enable.value,
        list: fixedList.value,
    })
    dialogRef.value?.close()
}

function handleCancel() {
    dialogRef.value?.close()
}

function getPersonDepartment(uuid: string): string {
    const person = allPersonList.value.find(p => p.uuid === uuid)
    return person?.department ?? ''
}
</script>

<template>
    <dialog ref="dialogRef" class="modal">
        <div class="modal-box w-11/12 max-w-3xl">
            <h3 class="font-bold text-lg mb-4">
                {{ t('dialog.fixedWinnersTitle') }}
            </h3>

            <!-- 提示信息 -->
            <div role="alert" class="alert alert-info mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{{ t('dialog.fixedWinnersTip') }}</span>
            </div>

            <!-- 启用开关 -->
            <div class="form-control mb-4">
                <label class="label cursor-pointer justify-start gap-4">
                    <input v-model="enable" type="checkbox" class="checkbox checkbox-primary">
                    <span class="label-text">{{ t('dialog.enableFixedWinners') }}</span>
                </label>
            </div>

            <!-- 添加内定人员 -->
            <div v-if="enable" class="mb-4">
                <div class="flex gap-2 items-end">
                    <div class="form-control flex-1 relative">
                        <label class="label">
                            <span class="label-text">{{ t('dialog.selectPerson') }}</span>
                        </label>
                        <input
                            v-model="searchText"
                            type="text"
                            class="input input-bordered w-full"
                            :placeholder="t('dialog.selectPerson')"
                            @input="handleSearchInput"
                            @focus="handleSearchFocus"
                            @blur="handleSearchBlur"
                        >
                        <!-- 下拉列表 -->
                        <ul
                            v-if="showDropdown && filteredPersonList.length > 0"
                            class="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto bg-base-100 border border-base-300 rounded-lg shadow-lg"
                        >
                            <li
                                v-for="person in filteredPersonList"
                                :key="person.uuid"
                                class="px-4 py-2 cursor-pointer hover:bg-base-200"
                                @mousedown.prevent="selectPerson(person)"
                            >
                                {{ person.name }} <span class="text-base-content/60">({{ person.department }})</span>
                            </li>
                        </ul>
                        <div
                            v-if="showDropdown && filteredPersonList.length === 0 && searchText"
                            class="absolute top-full left-0 right-0 z-50 mt-1 px-4 py-2 bg-base-100 border border-base-300 rounded-lg shadow-lg text-base-content/50"
                        >
                            {{ t('table.noneData') }}
                        </div>
                    </div>
                    <div class="form-control w-32">
                        <label class="label">
                            <span class="label-text">{{ t('table.position') }}</span>
                        </label>
                        <select v-model="selectedPosition" class="select select-bordered w-full">
                            <option v-for="opt in positionOptions" :key="opt.value ?? 'none'" :value="opt.value" :disabled="opt.value !== undefined && usedPositions.has(opt.value)">
                                {{ opt.label }}
                            </option>
                        </select>
                    </div>
                    <button class="btn btn-primary" :disabled="!selectedPersonUuid" @click="addFixedWinner">
                        {{ t('button.add') }}
                    </button>
                </div>
            </div>

            <!-- 内定人员列表 -->
            <div v-if="enable && fixedList.length > 0" class="mb-4">
                <table class="table table-zebra w-full">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>{{ t('table.name') }}</th>
                            <th>{{ t('table.position') }}</th>
                            <th>{{ t('table.operation') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, index) in fixedList" :key="item.uuid">
                            <td>{{ index + 1 }}</td>
                            <td>{{ item.name }} <span class="text-base-content/60">({{ getPersonDepartment(item.uuid) }})</span></td>
                            <td>
                                <select
                                    :value="item.position"
                                    class="select select-bordered select-sm w-24"
                                    @change="updatePosition(index, ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : undefined)"
                                >
                                    <option v-for="opt in positionOptions" :key="opt.value ?? 'none'" :value="opt.value" :disabled="opt.value !== undefined && opt.value !== item.position && usedPositions.has(opt.value)">
                                        {{ opt.label }}
                                    </option>
                                </select>
                            </td>
                            <td>
                                <button class="btn btn-error btn-xs" @click="removeFixedWinner(index)">
                                    <X class="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 空状态 -->
            <div v-if="enable && fixedList.length === 0" class="text-center py-8 text-base-content/50">
                {{ t('table.noneData') }}
            </div>

            <!-- 操作按钮 -->
            <div class="modal-action">
                <button class="btn" @click="handleCancel">
                    {{ t('button.cancel') }}
                </button>
                <button class="btn btn-primary" @click="handleSubmit">
                    {{ t('button.confirm') }}
                </button>
            </div>
        </div>
        <form method="dialog" class="modal-backdrop">
            <button>close</button>
        </form>
    </dialog>
</template>
