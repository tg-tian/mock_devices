import mqtt from 'mqtt'
import { propertiesTopic, configTopic, commandsTopic } from './lib/topics'
import { DeviceConfig } from './types/device'

const deviceId = 'ac001'
const client = mqtt.connect('mqtt://127.0.0.1:1883')

let currentTemp = 25
let targetTemp = 24
let hvacMode = 'auto'

let ticker: NodeJS.Timeout | undefined


const config: DeviceConfig = {
  deviceId : deviceId,
  deviceName: '海尔空调1001',
  provider: 'mqtt',
  model: 'HAIER-AC-1001',
  category: 'ac',
  properties: {
    current_temperature: { type: 'number', unit: '°C', readOnly: true },
    temperature: { type: 'number', unit: '°C', readOnly: false },
    hvac_mode: { type: 'string', readOnly: false }
  },
  events: {
    lowBattery: { level: 'warning' }
  },
  actions: {
    reset: { arguments: [] }
  },
  tags: { room: 'living-room' }
}

function publishState() {
  const steps = [-1, -0.5, 0, 0.5, 1]
  const offset = steps[Math.floor(Math.random() * steps.length)]
  const next = targetTemp + offset
  currentTemp = Math.max(16, Math.min(30, Math.round(next * 2) / 2))
  console.log(`🎲 随机温度生成: ${currentTemp}°C`)
  const payload = {
    temperature: targetTemp,
    current_temperature: currentTemp,
    hvac_mode: hvacMode
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
  ticker = setInterval(() => {publishState()}, 3000)
  publishState()
})

client.on('message', (topic, message) => {
  if (topic === commandsTopic(deviceId)) {
    try {
      const payload = JSON.parse(message.toString())
      console.log(`📥 收到命令: ${JSON.stringify(payload)}`)
      
      if (payload.action === 'setMode' && payload.args && payload.args.mode) {
        hvacMode = payload.args.mode
        publishState()
      } else if (payload.action === 'setTemperature' && payload.args && payload.args.temp) {
        targetTemp = payload.args.temp
        publishState()
      }
    } catch (error) {
      console.error('❌ 解析命令失败:', error)
    }
  }
})

process.on('SIGINT', () => {
  if (ticker) clearInterval(ticker)
  client.end()
  process.exit(0)
})
