import mqtt from 'mqtt'
import { propertiesTopic, configTopic, commandsTopic, eventsTopic } from './lib/topics'
import { DeviceConfig } from './types/device'

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883'
const deviceId = process.env.DEVICE_ID || 'camera001'
const provider = process.env.DEVICE_PROVIDER || 'mqtt'
const deviceModel = process.env.DEVICE_MODEL || 'DFT10'
const deviceName = process.env.DEVICE_NAME || 'AI摄像头 DFT10-01'

const client = mqtt.connect(brokerUrl)

let powerOn = true
let ticker: NodeJS.Timeout | undefined
let eventTicker: NodeJS.Timeout | undefined

const people = [
  { person_id: 'P1001', person_name: '张三', meeting_room: 'A101', vip: false },
  { person_id: 'P1002', person_name: '李四', meeting_room: 'A201', vip: true },
  { person_id: 'P1003', person_name: '王五', meeting_room: 'B301', vip: false },
  { person_id: 'P1004', person_name: '赵六', meeting_room: 'C120', vip: false }
]

const config: DeviceConfig = {
  deviceId,
  deviceName,
  provider,
  deviceModel,
  category: 'camera',
  properties: {},
  events: {
    attendee_detected: {
      level: 'info',
      description: '识别到参会人员',
      fields: {
        vip: { type: 'boolean', description: '是否 VIP' },
        person_id: { type: 'string', description: '人员 ID' },
        person_name: { type: 'string', description: '人员姓名' },
        meeting_room: { type: 'string', description: '会议室' }
      }
    }
  },
  actions: {
    on: { arguments: {}, description: '开启摄像头' },
    off: { arguments: {}, description: '关闭摄像头' }
  },
  tags: { area: 'meeting-room', deviceType: 'camera' }
}

function publishConfig() {
  client.publish(configTopic(deviceId), JSON.stringify(config), { retain: true })
  console.log(`📡 上报配置 -> 主题:${configTopic(deviceId)} | 载荷:${JSON.stringify(config)}`)
}

function publishState() {
  const payload = {
    power_on: powerOn,
    stream_status: powerOn ? 'online' : 'offline',
    last_seen: new Date().toISOString()
  }
  client.publish(propertiesTopic(deviceId), JSON.stringify(payload))
  console.log(`📤 属性上报 -> 主题:${propertiesTopic(deviceId)} | 载荷:${JSON.stringify(payload)}`)
}

function reportEvent() {
  if (!powerOn) return

  const selected = people[Math.floor(Math.random() * people.length)]
  const payload = {
    attendee_detected: {
      ...selected,
      timestamp: Date.now()
    }
  }
  client.publish(eventsTopic(deviceId), JSON.stringify(payload))
  console.log(`🔔 事件上报 -> 主题:${eventsTopic(deviceId)} | 载荷:${JSON.stringify(payload)}`)
}

function handleCommand(rawMessage: Buffer) {
  try {
    const payload = JSON.parse(rawMessage.toString())
    console.log(`📥 收到命令: ${JSON.stringify(payload)}`)

    const action = payload.action || payload.type
    if (action === 'on') {
      powerOn = true
      publishState()
      reportEvent()
      return
    }

    if (action === 'off') {
      powerOn = false
      publishState()
      return
    }

    console.log(`ℹ️ 未识别命令，已忽略: ${action}`)
  } catch (error) {
    console.error('❌ 解析命令失败:', error)
  }
}

client.on('connect', () => {
  console.log(`✅ 已连接 MQTT: ${brokerUrl}`)
  publishConfig()
  client.subscribe(commandsTopic(deviceId))
  console.log(`📩 订阅命令 -> 主题:${commandsTopic(deviceId)}`)

  ticker = setInterval(() => publishState(), 3000)
  

  publishState()
  reportEvent()
})

client.on('message', (topic, message) => {
  if (topic === commandsTopic(deviceId)) {
    handleCommand(message)
  }
})

process.on('SIGINT', () => {
  if (ticker) clearInterval(ticker)
  if (eventTicker) clearInterval(eventTicker)
  client.end()
  process.exit(0)
})
