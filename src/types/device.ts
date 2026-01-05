export type PropertyType = 'number' | 'string' | 'boolean'

export interface DeviceProperty {
  type: PropertyType
  unit?: string
  readOnly: boolean
}

export interface DeviceConfig {
  deviceId: string
  deviceName: string
  provider?: string
  model: string
  category: string
  properties: Record<string, DeviceProperty>
  events: Record<string, { level: string }>
  actions: Record<string, { arguments: any[] }>
  tags?: Record<string, string>
}

export interface DeviceCommand {
  action: string
  arguments?: any
}
