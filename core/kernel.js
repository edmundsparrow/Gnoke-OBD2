/**
 * Gnokestation OBD-II Kernel v2.0
 * Hardware Abstraction Layer for Serial and BLE communication
 * 
 * Production-ready with:
 * - Command queuing to prevent ELM327 buffer overflow
 * - Automatic protocol detection
 * - Robust error handling
 * - Support for both Web Serial and Web Bluetooth APIs
 * 
 * NEVER NEEDS MODIFICATION - All hardware communication logic is here
 */

window.OBDKernel = class OBDInterface {
    constructor() {
        // Serial connection
        this.port = null;
        this.reader = null;
        this.writer = null;
        
        // BLE connection
        this.device = null;
        this.characteristic = null;
        
        // Connection state
        this.connected = false;
        this.buffer = '';
        
        // Command queue management
        this.commandQueue = [];
        this.isProcessingQueue = false;
        this.lastCommandTime = 0;
        this.minCommandDelay = 150; // Prevent ELM327 congestion
    }

    /**
     * Connect via Web Serial API (USB/Serial)
     */
    async connectSerial() {
        try {
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate: 38400 });
            
            this.reader = this.port.readable.getReader();
            this.writer = this.port.writable.getWriter();
            this.connected = true;
            
            this.startReading();
            await this.initELM327();
            return true;
        } catch (err) {
            System.log('Kernel', `Serial connection failed: ${err.message}`);
            return false;
        }
    }

    /**
     * Connect via Web Bluetooth API
     */
    async connectBLE() {
        try {
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['0000fff0-0000-1000-8000-00805f9b34fb'] }],
                optionalServices: ['0000fff0-0000-1000-8000-00805f9b34fb']
            });
            
            const server = await this.device.gatt.connect();
            const service = await server.getPrimaryService('0000fff0-0000-1000-8000-00805f9b34fb');
            this.characteristic = await service.getCharacteristic('0000fff1-0000-1000-8000-00805f9b34fb');
            
            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', (e) => {
                const value = new TextDecoder().decode(e.target.value);
                this.handleIncomingData(value);
            });

            this.connected = true;
            await this.initELM327();
            return true;
        } catch (err) {
            System.log('Kernel', `BLE connection failed: ${err.message}`);
            return false;
        }
    }

    /**
     * Initialize ELM327 adapter with optimal settings
     */
    async initELM327() {
        System.log('Kernel', 'Initializing ELM327 adapter...');
        
        const initCommands = [
            'ATZ',    // Reset
            'ATE0',   // Echo off
            'ATL0',   // Linefeeds off
            'ATS0',   // Spaces off
            'ATH1',   // Headers on
            'ATAT1',  // Adaptive timing auto1
            'ATSP0'   // Auto protocol detect
        ];
        
        for (const cmd of initCommands) {
            try {
                await this.sendCommand(cmd);
                // Special delay after reset
                await new Promise(r => setTimeout(r, cmd === 'ATZ' ? 1500 : 100));
            } catch (err) {
                System.log('Kernel', `Init warning: ${cmd} - ${err.message}`);
            }
        }
        
        System.log('Kernel', '✓ ELM327 ready');
    }

    /**
     * Send command with queue management
     * This is the main API plugins use to communicate with hardware
     */
    async sendCommand(cmd, timeout = 3000) {
        return new Promise((resolve, reject) => {
            this.commandQueue.push({ cmd, resolve, reject, timeout });
            this.processQueue();
        });
    }

    /**
     * Process command queue with timing control
     * Prevents overwhelming the ELM327 adapter
     */
    async processQueue() {
        if (this.isProcessingQueue || this.commandQueue.length === 0) return;
        this.isProcessingQueue = true;

        while (this.commandQueue.length > 0) {
            const { cmd, resolve, reject, timeout } = this.commandQueue.shift();
            
            // Respect hardware timing constraints
            const now = Date.now();
            const wait = Math.max(0, this.minCommandDelay - (now - this.lastCommandTime));
            if (wait > 0) await new Promise(r => setTimeout(r, wait));

            try {
                this.buffer = '';
                const dataToSend = new TextEncoder().encode(cmd + '\r');
                
                if (this.writer) {
                    // Serial connection
                    await this.writer.write(dataToSend);
                } else if (this.characteristic) {
                    // BLE connection
                    await this.characteristic.writeValue(dataToSend);
                }

                const result = await this.waitForResponse(timeout);
                this.lastCommandTime = Date.now();
                resolve(result);
            } catch (err) {
                reject(err);
            }
        }
        
        this.isProcessingQueue = false;
    }

    /**
     * Wait for ELM327 prompt ('>') indicating command complete
     */
    waitForResponse(timeout) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const check = setInterval(() => {
                if (this.buffer.includes('>')) {
                    clearInterval(check);
                    resolve(this.buffer.replace('>', '').trim());
                } else if (Date.now() - start > timeout) {
                    clearInterval(check);
                    reject(new Error('Timeout waiting for response'));
                }
            }, 50);
        });
    }

    /**
     * Serial data stream reader
     */
    async startReading() {
        while (this.port && this.port.readable) {
            try {
                const { value, done } = await this.reader.read();
                if (done) break;
                this.handleIncomingData(new TextDecoder().decode(value));
            } catch (err) {
                System.log('Kernel', `Read error: ${err.message}`);
                break;
            }
        }
    }

    /**
     * Incoming data handler (both Serial and BLE)
     */
    handleIncomingData(data) {
        this.buffer += data;
    }

    /**
     * Disconnect and cleanup
     * Called by System.shutdown()
     */
    async disconnect() {
        this.connected = false;
        this.commandQueue = [];
        this.isProcessingQueue = false;
        
        if (this.reader) {
            try {
                await this.reader.cancel();
            } catch (err) {
                // Silently handle cleanup errors
            }
            this.reader = null;
        }
        
        if (this.writer) {
            try {
                await this.writer.close();
            } catch (err) {
                // Silently handle cleanup errors
            }
            this.writer = null;
        }
        
        if (this.port) {
            try {
                await this.port.close();
            } catch (err) {
                // Silently handle cleanup errors
            }
            this.port = null;
        }
        
        if (this.device && this.device.gatt.connected) {
            try {
                this.device.gatt.disconnect();
            } catch (err) {
                // Silently handle cleanup errors
            }
        }
        
        this.device = null;
        this.characteristic = null;
    }
};

System.log('Kernel', 'OBD-II Kernel loaded');

