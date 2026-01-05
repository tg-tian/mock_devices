import mqtt from 'mqtt'
import { propertiesTopic, configTopic } from './lib/topics'
import { DeviceConfig } from './types/device'

const deviceId = 'th001'
const client = mqtt.connect('mqtt://127.0.0.1:1883')

let ticker: NodeJS.Timeout | undefined

const config: DeviceConfig = {
  deviceId,
  deviceName: '温度计S01',
  provider: 'mqtt',
  model: 'MI-THERMO-S01',
  category: 'thermometer',
  properties: {
    temperature: { type: 'number', unit: '°C', readOnly: true }
  },
  events: {},
  actions: {},
  tags: { room: 'bedroom' }
}

client.on('connect', () => {
  console.log('✅ 已连接 MQTT')
  console.log(`📡 上报配置 -> 主题:${configTopic(deviceId)}`)
  client.publish(configTopic(deviceId), JSON.stringify(config), { retain: true })
  ticker = setInterval(() => publishTelemetry(), 3000)
})

function publishTelemetry() {
  const t = Math.round((24 + (Math.random() - 0.5) * 4) * 2) / 2
  const payload = { temperature: t }
  client.publish(propertiesTopic(deviceId), JSON.stringify(payload))
  console.log(`📤 属性上报 -> 主题:${propertiesTopic(deviceId)} | 载荷:${JSON.stringify(payload)}`)
}

process.on('SIGINT', () => {
  if (ticker) clearInterval(ticker)
  client.end()
  process.exit(0)
})
