import mqtt from 'mqtt'
import { propertiesTopic, configTopic, commandsTopic, eventsTopic } from './lib/topics'
import { DeviceConfig } from './types/device'

const deviceId = 'coffee001'
const client = mqtt.connect('mqtt://127.0.0.1:1883')

let beanLevel = 60
let waterLevel = 80
let totalCups = 0
let powerState: 'on' | 'off' | 'sleep' = 'off'
let workStatus: 'idle' | 'brewing' | 'error' | 'selfCheck' = 'idle'
let temperature = 25
let lastLowWaterAt = 0
let lastLowBeanAt = 0
let brewTimer: NodeJS.Timeout | undefined
let selfCheckTimer: NodeJS.Timeout | undefined
let brewStartAt: number | null = null
let brewDurationSec = 0
let brewCupId = ''
let brewCoffeeType = ''
let ticker: NodeJS.Timeout | undefined

const config: DeviceConfig = {
  deviceId,
  deviceName: '智能咖啡机001',
  provider: 'mqtt',
  model: '咖啡机',
  category: 'coffer',
  properties: {
    beanLevel: {type: 'number', unit: '%', readOnly: true, description: '咖啡豆余量' },
    totalCups: {type: 'number', unit: 'cups', readOnly: true, description: '累计制作杯数' },
    powerState: {type: 'string', readOnly: false, description: '电源状态' },
    waterLevel: {type: 'number', unit: '%', readOnly: true, description: '当前水位' },
    workStatus: {type: 'string', readOnly: true, description: '工作状态' },
    temperature: {type: 'number', unit: '°C', readOnly: true, description: '锅炉温度' }
  },
  events: {
    onError: {
      level: 'error',
      fields: {
        message: { max: null, min: null, type: 'string', unit: '', readOnly: false, enumValues: [], description: '错误消息' },
        errorCode: { max: null, min: null, type: 'string', unit: '', readOnly: false, enumValues: [], description: '错误代码' }
      },
      description: '发生故障'
    },
    onLowWater: {
      level: 'warning',
      fields: {
        level: { max: 50, min: 0, type: 'number', unit: '%', readOnly: false, enumValues: [], description: '等级（0%停机 5%错误 10%警告）' }
      },
      description: '水位异常'
    },
    refillBeans: {
      level: 'warning',
      fields: {
        level: { max: 50, min: 0, type: 'number', unit: '', readOnly: false, enumValues: [], description: '等级（0%停机 5%错误 10%警告）' }
      },
      description: '豆异常'
    },
    onBrewCompleted: {
      level: 'info',
      fields: {
        cupId: { max: null, min: null, type: 'string', unit: '', readOnly: false, enumValues: [], description: '杯id' },
        duration: { max: 300, min: 1, type: 'number', unit: '秒', readOnly: false, enumValues: [], description: '时间' },
        coffeeType: { max: null, min: null, type: 'string', unit: '', readOnly: false, enumValues: [], description: '咖啡类型' }
      },
      description: '咖啡制作成功完成'
    }
  },
  actions: {
    wakeUp: { arguments: {}, description: '从休眠唤醒' },
    powerOn: { arguments: {}, description: '开机（IDLE）状态' },
    powerOff: { arguments: {}, description: '关机 （OFF）状态' },
    stopBrew: { arguments: {}, description: '中断当前制作' },
    selfCheck: { arguments: {}, description: '执行自检' },
    startBrew: { arguments: { coffeeType: { max: null, min: null, type: 'enum', unit: '', readOnly: false, enumValues: ['美式', '拿铁'], description: '咖啡类型' } }, description: '开始制作指定咖啡' },
    markCoffee: { arguments: { cupId: { max: null, min: null, type: 'string', unit: '', readOnly: false, enumValues: [], description: '杯id' } }, description: '标记一杯咖啡完成（用于追踪）' },
    refillBeans: { arguments: { amount: { max: 20, min: 5, type: 'number', unit: 'g', readOnly: false, enumValues: [], description: '加豆(g)' } }, description: '加豆' },
    refillWater: { arguments: { amount: { max: 300, min: 50, type: 'number', unit: 'ml', readOnly: false, enumValues: [], description: '加水（ml）' } }, description: '加水' },
    enterSleepMode: { arguments: {}, description: '进入休眠模式' }
  }
}

function startBrew(coffeeType: string) {
  if (workStatus === 'brewing') return
  if (powerState === 'off') powerState = 'on'
  workStatus = 'brewing'
  brewStartAt = Date.now()
  brewDurationSec = Math.floor(Math.random() * 120) + 30
  brewCupId = `cup-${brewStartAt}`
  brewCoffeeType = coffeeType
  if (brewTimer) clearTimeout(brewTimer)
  brewTimer = setTimeout(() => {
    if (workStatus !== 'brewing') return
    workStatus = 'idle'
    totalCups += 1
    reportEvent('onBrewCompleted', {
      cupId: brewCupId,
      duration: brewDurationSec,
      coffeeType: brewCoffeeType
    })
    brewStartAt = null
  }, brewDurationSec * 1000)
}

function stopBrew() {
  if (brewTimer) clearTimeout(brewTimer)
  workStatus = 'idle'
  brewStartAt = null
}

function runSelfCheck() {
  if (selfCheckTimer) clearTimeout(selfCheckTimer)
  workStatus = 'selfCheck'
  selfCheckTimer = setTimeout(() => {
    workStatus = 'idle'
  }, 5000)
}

function reportEvent(eventName: string, data: any) {
  const payload = {
    [eventName]: {
      ...data,
      timestamp: Date.now()
    }
  }
  client.publish(eventsTopic(deviceId), JSON.stringify(payload))
  console.log(`🔔 事件上报 -> 主题:${eventsTopic(deviceId)} | 载荷:${JSON.stringify(payload)}`)
}

function publishState() {
  const now = Date.now()
  if (workStatus === 'brewing') {
    beanLevel = Math.max(0, beanLevel - 1)
    waterLevel = Math.max(0, waterLevel - 1)
  }

  if (waterLevel === 0 || beanLevel === 0) {
    if (workStatus !== 'error') {
      workStatus = 'error'
      reportEvent('onError', {
        message: waterLevel === 0 ? 'Water empty' : 'Beans empty',
        errorCode: waterLevel === 0 ? 'WATER_EMPTY' : 'BEAN_EMPTY'
      })
    }
  }

  if (waterLevel <= 10 && now - lastLowWaterAt > 30000) {
    lastLowWaterAt = now
    reportEvent('onLowWater', { level: waterLevel })
  }

  if (beanLevel <= 10 && now - lastLowBeanAt > 30000) {
    lastLowBeanAt = now
    reportEvent('refillBeans', { level: beanLevel })
  }

  let targetTemp = 25
  if (powerState === 'on') {
    targetTemp = workStatus === 'brewing' ? 92 : 60
  } else if (powerState === 'sleep') {
    targetTemp = 30
  }
  temperature = Math.max(20, Math.min(105, Math.round((temperature + (targetTemp - temperature) * 0.2) * 10) / 10))

  const payload = {
    beanLevel,
    totalCups,
    powerState,
    waterLevel,
    workStatus,
    temperature
  }
  client.publish(propertiesTopic(deviceId), JSON.stringify(payload))
  console.log(`📤 属性上报 -> 主题:${propertiesTopic(deviceId)} | 载荷:${JSON.stringify(payload)}`)
}


client.on('connect', () => {
  console.log('✅ 已连接 MQTT')
  console.log(`📡 上报配置 -> 主题:${configTopic(deviceId)}`)
  client.publish(configTopic(deviceId), JSON.stringify(config), { retain: true })
  client.subscribe(commandsTopic(deviceId))
  console.log(`📩 订阅命令 -> 主题:${commandsTopic(deviceId)}`)
  ticker = setInterval(() => publishState(), 3000)
  publishState()
})

//设备响应command

client.on('message', (topic, message) => {
  if (topic !== commandsTopic(deviceId)) return
  try {
    const payload = JSON.parse(message.toString())
    console.log(`📥 收到命令: ${JSON.stringify(payload)}`)
    const args = payload.args || {}

    if (payload.action === 'wakeUp') {
      if (powerState === 'sleep') powerState = 'on'
    } else if (payload.action === 'powerOn') {
      powerState = 'on'
      if (workStatus === 'error') workStatus = 'idle'
    } else if (payload.action === 'powerOff') {
      powerState = 'off'
      stopBrew()
      workStatus = 'idle'
    } else if (payload.action === 'enterSleepMode') {
      powerState = 'sleep'
      stopBrew()
      workStatus = 'idle'
    } else if (payload.action === 'stopBrew') {
      stopBrew()
    } else if (payload.action === 'selfCheck') {
      runSelfCheck()
    } else if (payload.action === 'startBrew' && args.coffeeType !== undefined) {
      startBrew(args.coffeeType)
    } else if (payload.action === 'markCoffee' && args.cupId !== undefined) {
      totalCups += 1
      reportEvent('onBrewCompleted', {
        cupId: args.cupId,
        duration: Math.floor(Math.random() * 180) + 30,
        coffeeType: args.coffeeType || '美式'
      })
    } else if (payload.action === 'refillBeans' && args.amount !== undefined) {
      beanLevel = Math.min(100, beanLevel + Math.round(args.amount * 2))
    } else if (payload.action === 'refillWater' && args.amount !== undefined) {
      waterLevel = Math.min(100, waterLevel + Math.round(args.amount / 3))
    }
    publishState()
  } catch (error) {
    console.error('❌ 解析命令失败:', error)
  }
})

process.on('SIGINT', () => {
  if (ticker) clearInterval(ticker)
  if (brewTimer) clearTimeout(brewTimer)
  if (selfCheckTimer) clearTimeout(selfCheckTimer)
  client.end()
  process.exit(0)
})
