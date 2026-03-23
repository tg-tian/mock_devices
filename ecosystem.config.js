module.exports = {
    apps: [
        {
            name: 'mock-thermometer',
            cwd: '/root/mte-mock-devices',
            script: 'node_modules/.bin/ts-node',
            args: 'src/thermometer.ts',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '256M',
            env: { NODE_ENV: 'development' },
            error_file: '/root/logs/mock-thermometer-error.log',
            out_file: '/root/logs/mock-thermometer-out.log',
            time: true
        },
        {
            name: 'mock-ac',
            cwd: '/root/mte-mock-devices',
            script: 'node_modules/.bin/ts-node',
            args: 'src/ac.ts',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '256M',
            env: { NODE_ENV: 'development' },
            error_file: '/root/logs/mock-ac-error.log',
            out_file: '/root/logs/mock-ac-out.log',
            time: true
        },
        {
            name: 'mock-coffee',
            cwd: '/root/mte-mock-devices',
            script: 'node_modules/.bin/ts-node',
            args: 'src/coffee.ts',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '256M',
            env: { NODE_ENV: 'development' },
            error_file: '/root/logs/mock-coffee-error.log',
            out_file: '/root/logs/mock-coffee-out.log',
            time: true
        },
        {
            name: 'mock-robot',
            cwd: '/root/mte-mock-devices',
            script: 'node_modules/.bin/ts-node',
            args: 'src/robot.ts',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '256M',
            env: { NODE_ENV: 'development' },
            error_file: '/root/logs/mock-robot-error.log',
            out_file: '/root/logs/mock-robot-out.log',
            time: true
        }
    ]
};