import mqtt from 'mqtt'
import { propertiesTopic, configTopic, commandsTopic, eventsTopic } from './lib/topics'
import { DeviceConfig } from './types/device'

const deviceId = 'coffee001'
const client = mqtt.connect('mqtt://127.0.0.1:1883')

let waterTemp = 92
let waterLevel = 80

enum CoffeeMachineStatus {
  Idle = 'idle',
  Brewing = 'brewing',
  Error = 'error'
}

let status: CoffeeMachineStatus = CoffeeMachineStatus.Idle;

let ticker: NodeJS.Timeout | undefined
let eventTicker: NodeJS.Timeout | undefined

const config: DeviceConfig = {
  deviceId: deviceId,
  deviceName: '德龙咖啡机2001',
  provider: 'mqtt',
  deviceModel: 'DELONGHI-CF-2001',
  category: 'coffee_machine',
  properties: {
    water_temperature: { type: 'number', unit: '°C', readOnly: true },
    water_level: { type: 'number', unit: '%', readOnly: true },
    status: { type: 'string', enumValues: Object.values(CoffeeMachineStatus), readOnly: true }
  },
  events: {
    coffeeComplete: { 
      level: 'info', 
      fields: { 
        coffee_type: { type: 'string' }, 
        duration: { type: 'number' }, 
        start_time: { type: 'string'} 
      } 
    },
    sys_error: { level: 'error', fields: { code: { type: 'string' }, msg: { type: 'string' } } },
    water_low: { level: 'warning', fields: { level: { type: 'number' } } }
  },
  actions: {
    makeCoffee: { 
      arguments: { 
        coffee_type: { 
          type: 'string', 
          enumValues: ['Americano', 'Latte', 'Espresso', 'Cappuccino'] 
        } 
      } 
    },
    reset: { arguments: {} }
  },
  tags: { room: 'kitchen' }
}


function reportCoffeeComplete(coffeeType: string, duration: number, startTime: string) {
  const payload = {
    coffeeComplete: {
      coffee_type: coffeeType,
      duration,
      start_time: startTime,
      timestamp: Date.now()
    }
  }
  client.publish(eventsTopic(deviceId), JSON.stringify(payload))
  console.log(`🔔 事件上报 -> 主题:${eventsTopic(deviceId)} | 载荷:${JSON.stringify(payload)}`)
}

function makeCoffee(coffeeType: string) {
  if (status === CoffeeMachineStatus.Brewing) {
    console.log('⚠️ 正在制作中，忽略请求')
    return
  }

  status = CoffeeMachineStatus.Brewing;
  const brewTime = 5000;
  const startTime = new Date().toISOString();
  console.log(`☕ 开始制作 ${coffeeType}，预计 ${brewTime / 1000}s`);
  publishState();

  // 模拟水位下降
  waterLevel = Math.max(0, waterLevel - Math.floor(Math.random() * 10 + 10));

  setTimeout(() => {
    status = CoffeeMachineStatus.Idle;
    publishState();
    reportCoffeeComplete(coffeeType, brewTime / 1000, startTime);
  }, brewTime);
}

function publishState() {
  // 模拟水温小幅波动
  const offset = (Math.random() - 0.5) * 2
  waterTemp = Math.round((waterTemp + offset) * 10) / 10
  waterTemp = Math.max(85, Math.min(96, waterTemp))

  const payload = {
    water_temperature: waterTemp,
    water_level: waterLevel,
    status
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
  ticker = setInterval(() => { publishState() }, 3000)
  publishState()
})

client.on('message', (topic, message) => {
  if (topic === commandsTopic(deviceId)) {
    try {
      const payload = JSON.parse(message.toString())
      console.log(`📥 收到命令: ${JSON.stringify(payload)}`)

      if (payload.action === 'makeCoffee' && payload.args) {
        const coffeeType = payload.args.coffee_type || 'Espresso'
        makeCoffee(coffeeType)
      } else if (payload.action === 'reset') {
        status = CoffeeMachineStatus.Idle;
        waterLevel = 100
        waterTemp = 92
        publishState()
        console.log('🔄 设备已重置')
      }
    } catch (error) {
      console.error('❌ 解析命令失败:', error)
    }
  }
})

process.on('SIGINT', () => {
  if (ticker) clearInterval(ticker)
  if (eventTicker) clearInterval(eventTicker)
  client.end()
  process.exit(0)
})
