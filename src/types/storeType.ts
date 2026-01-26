export interface IPersonConfig {
    id: number
    uid: string
    uuid: string
    name: string
    department: string
    identity: string
    avatar: string
    isWin: boolean
    x: number
    y: number
    createTime: string
    updateTime: string
    prizeName: string[]
    prizeId: string[]
    prizeTime: string[]
}
export interface Separate {
    id: string
    count: number
    isUsedCount: number
}
// 内定人员配置
export interface FixedWinnerItem {
    uuid: string // 人员uuid
    name: string // 人员姓名（用于显示）
    position?: number // 指定位置（从1开始），不指定则随机分配位置
}
export interface FixedWinners {
    enable: boolean // 是否启用内定
    list: FixedWinnerItem[] // 内定人员列表
}
export interface IPrizeConfig {
    id: number | string
    name: string
    sort: number
    isAll: boolean
    count: number
    isUsedCount: number
    picture: {
        id: string
        name: string
        url: string | Blob | ArrayBuffer
    }
    separateCount: {
        enable: boolean
        countList: Separate[]
    }
    desc: string
    isShow: boolean
    isUsed: boolean
    frequency: number
    fixedWinners?: FixedWinners // 内定配置
}
export interface IMusic {
    id: string
    name: string
    url: string | Blob | ArrayBuffer
}

export interface IImage {
    id: string
    name: string
    url: string | Blob | ArrayBuffer
}

export interface WsMsgData { data: string, id: string, dateTime: string }
export interface ServerType {
    id: string
    name: string
    value: string
    host: string
}
