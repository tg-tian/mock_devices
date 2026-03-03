export type PropertyType = 'number' | 'string' | 'boolean'

export interface DeviceProperty {
  type: PropertyType
  unit?: string
  readOnly?: boolean
  enumValues?: any[]
  description?: string
}

export interface DeviceEvent {
  fields?: Record<string, DeviceProperty>;
  level?: "info" | "warning" | "error";
  description?: string;
  timestamp?: string;
}

export interface DeviceAction {
  arguments?: Record<string, DeviceProperty>;
  description?: string;
}

export interface DeviceConfig {
  deviceId: string
  deviceName: string
  provider?: string
  deviceModel: string
  category: string
  properties: Record<string, DeviceProperty>
  events: Record<string, DeviceEvent>
  actions: Record<string, DeviceAction>
  tags?: Record<string, string>
}
