import mqtt from 'mqtt'
import { propertiesTopic, configTopic, commandsTopic, eventsTopic } from './lib/topics'
import { DeviceConfig } from './types/device'

const deviceId = 'robot001'
const client = mqtt.connect('mqtt://127.0.0.1:1883')

// 定义状态枚举
enum RobotStatus {
  Idle = 'idle',
  Moving = 'moving',
  Delivering = 'delivering',
  Charging = 'charging',
  Error = 'error'
}

// 内部状态
let status: RobotStatus = RobotStatus.Idle
let batteryLevel = 95
let ticker: NodeJS.Timeout | undefined

// 设备配置
const config: DeviceConfig = {
  deviceId,
  deviceName: '送餐机器人',
  provider: 'mqtt',
  deviceModel: 'DeliveryRobot-X1',
  category: 'robot',
  properties: {
    status: { 
      type: 'string', 
      unit: '', 
      readOnly: false, 
      enumValues: Object.values(RobotStatus),
      description: '机器人状态'
    },
    batteryLevel: { 
      type: 'number', 
      unit: '%', 
      readOnly: false, 
      description: '电量'
    }
  },
  events: {
    deliveryComplete: {
      level: 'info',
      description: '送餐完成',
      fields: {
        order_id: { type: 'string', description: '订单ID' },
        finish_time: { type: 'string', description: '完成时间' }
      }
    },
    deliveryFailed: {
      level: 'info',
      description: '送餐失败',
      fields: {
        reason: { type: 'string', description: '失败原因' }
      }
    }
  },
  actions: {
    deliverFood: {
      description: '执行送餐任务',
      arguments: {
        order_id: { type: 'string', description: '订单ID' },
        pickup_location: { type: 'string', description: '取餐位置' },
        target_location: { type: 'string', description: '送达位置' }
      }
    }
  }
}

// 上报送餐完成事件
function reportDeliveryComplete(orderId: string) {
  const payload = {
    deliveryComplete: {
      order_id: orderId,
      finish_time: new Date().toISOString(),
      timestamp: Date.now()
    }
  }
  client.publish(eventsTopic(deviceId), JSON.stringify(payload))
  console.log(`🔔 事件上报 -> 主题:${eventsTopic(deviceId)} | 载荷:${JSON.stringify(payload)}`)
}

// 执行送餐任务
function deliverFood(orderId: string, pickup: string, target: string) {
  if (status !== RobotStatus.Idle && status !== RobotStatus.Charging) {
    console.log(`⚠️ 机器人忙碌中 (${status})，忽略任务`)
    return
  }

  console.log(`🚀 接到订单 ${orderId}: 从 ${pickup} 送往 ${target}`)
  
  // 模拟送餐过程
  // 1. 去取餐
  status = RobotStatus.Moving
  publishState()
  
  setTimeout(() => {
    // 2. 取餐后送餐中
    status = RobotStatus.Delivering
    publishState()
    
    // 消耗电量
    batteryLevel = Math.max(0, batteryLevel - 5)
    
    setTimeout(() => {
      // 3. 完成
      status = RobotStatus.Idle
      publishState()
      reportDeliveryComplete(orderId)
      console.log(`✅ 订单 ${orderId} 送达完成`)
    }, 5000) // 送餐耗时 5秒
  }, 3000) // 取餐耗时 3秒
}

// 上报属性状态
function publishState() {
  // 模拟电量变化 (如果闲置且没充满，慢慢充电？或者自然耗电？简单点，随机波动一点点或者不变)
  if (status === RobotStatus.Idle && batteryLevel < 100 && Math.random() > 0.8) {
      batteryLevel += 1 // 模拟闲置时自动回充
  }

  const payload = {
    status,
    batteryLevel
  }
  client.publish(propertiesTopic(deviceId), JSON.stringify(payload))
  console.log(`📤 属性上报 -> 主题:${propertiesTopic(deviceId)} | 载荷:${JSON.stringify(payload)}`)
}

// MQTT 连接与监听
client.on('connect', () => {
  console.log('✅ 已连接 MQTT')
  console.log(`📡 上报配置 -> 主题:${configTopic(deviceId)}`)
  client.publish(configTopic(deviceId), JSON.stringify(config), { retain: true })
  
  client.subscribe(commandsTopic(deviceId))
  console.log(`📩 订阅命令 -> 主题:${commandsTopic(deviceId)}`)
  
  // 定时上报状态
  ticker = setInterval(() => publishState(), 3000)
  publishState()
})

client.on('message', (topic, message) => {
  if (topic === commandsTopic(deviceId)) {
    try {
      const payload = JSON.parse(message.toString())
      console.log(`📥 收到命令: ${JSON.stringify(payload)}`)
      
      if (payload.action === 'deliverFood' && payload.args) {
        const { order_id, pickup_location, target_location } = payload.args
        if (order_id && pickup_location && target_location) {
          deliverFood(order_id, pickup_location, target_location)
        } else {
          console.error('❌ 参数不完整')
        }
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
