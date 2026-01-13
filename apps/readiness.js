/**
 * Gnokestation Readiness Monitors v1.0
 * 
 * Critical for emissions testing/inspection!
 * Shows which OBD-II monitors have completed their self-tests
 * 
 * In many regions, you CANNOT pass inspection until all monitors show "Ready"
 * This is a MUST-HAVE feature that AndrOBD has
 */

(() => {
    const ReadinessApp = {
        id: 'readiness',
        
        // Monitor status
        monitors: {
            misfire: { supported: false, complete: false },
            fuelSystem: { supported: false, complete: false },
            components: { supported: false, complete: false },
            catalyst: { supported: false, complete: false },
            heatedCatalyst: { supported: false, complete: false },
            evapSystem: { supported: false, complete: false },
            secondaryAir: { supported: false, complete: false },
            acRefrigerant: { supported: false, complete: false },
            oxygenSensor: { supported: false, complete: false },
            oxygenSensorHeater: { supported: false, complete: false },
            egrSystem: { supported: false, complete: false }
        },
        
        // System status
        milStatus: false, // Malfunction Indicator Lamp (Check Engine Light)
        dtcCount: 0,

        /**
         * Initialize readiness monitor
         */
        init() {
            System.log('Readiness', 'Initializing Monitor Status...');
            System.log('Readiness', '✓ Ready');
        },

        /**
         * Read monitor status (Mode 01 PID 01)
         */
        async readStatus() {
            if (window.isSimulating) {
                this.renderSimulatedStatus();
                return;
            }

            try {
                System.log('Readiness', 'Reading monitor status...');
                
                const raw = await window.obd.sendCommand('0101');
                const bytes = window.parseOBDResponse(raw, '4101');
                
                if (!bytes || bytes.length < 4) {
                    throw new Error('Invalid response from vehicle');
                }
                
                this.parseStatus(bytes);
                this.render();
                
                System.log('Readiness', `✓ Status read - MIL: ${this.milStatus ? 'ON' : 'OFF'}, DTCs: ${this.dtcCount}`);
                
            } catch (err) {
                System.log('Readiness', `Error: ${err.message}`);
                alert('Failed to read readiness status');
            }
        },

        /**
         * Parse Mode 01 PID 01 response
         * Format: A B C D
         * A: MIL status and DTC count
         * B: Test availability (bit flags)
         * C: Test completion (bit flags)
         * D: Additional flags
         */
        parseStatus(bytes) {
            // Byte A: MIL and DTC count
            this.milStatus = (bytes[0] & 0x80) !== 0;
            this.dtcCount = bytes[0] & 0x7F;
            
            // Byte B: Supported tests
            const supported = bytes[1];
            
            // Byte C: Completed tests
            const complete = bytes[2];
            
            // Continuous monitors (always supported)
            this.monitors.misfire = {
                supported: true,
                complete: (complete & 0x10) === 0 // Inverted logic!
            };
            this.monitors.fuelSystem = {
                supported: true,
                complete: (complete & 0x20) === 0
            };
            this.monitors.components = {
                supported: true,
                complete: (complete & 0x40) === 0
            };
            
            // Non-continuous monitors (check if supported first)
            this.monitors.catalyst = {
                supported: (supported & 0x01) !== 0,
                complete: (supported & 0x01) !== 0 && (complete & 0x01) === 0
            };
            this.monitors.heatedCatalyst = {
                supported: (supported & 0x02) !== 0,
                complete: (supported & 0x02) !== 0 && (complete & 0x02) === 0
            };
            this.monitors.evapSystem = {
                supported: (supported & 0x04) !== 0,
                complete: (supported & 0x04) !== 0 && (complete & 0x04) === 0
            };
            this.monitors.secondaryAir = {
                supported: (supported & 0x08) !== 0,
                complete: (supported & 0x08) !== 0 && (complete & 0x08) === 0
            };
            this.monitors.oxygenSensor = {
                supported: (supported & 0x20) !== 0,
                complete: (supported & 0x20) !== 0 && (complete & 0x20) === 0
            };
            this.monitors.oxygenSensorHeater = {
                supported: (supported & 0x40) !== 0,
                complete: (supported & 0x40) !== 0 && (complete & 0x40) === 0
            };
            this.monitors.egrSystem = {
                supported: (supported & 0x80) !== 0,
                complete: (supported & 0x80) !== 0 && (complete & 0x80) === 0
            };
        },

        /**
         * Render monitor status to UI
         */
        render() {
            const container = document.getElementById('readiness-list');
            if (!container) return;
            
            // Clear container
            container.innerHTML = '';
            
            // MIL Status header
            const milDiv = document.createElement('div');
            milDiv.className = 'readiness-header';
            milDiv.style.cssText = `
                padding: 16px;
                background: ${this.milStatus ? 'var(--red)' : 'var(--green)'};
                color: white;
                border-radius: 8px;
                margin-bottom: 12px;
                text-align: center;
                font-weight: 700;
            `;
            milDiv.innerHTML = `
                <div style="font-size: 18px;">
                    ${this.milStatus ? '⚠️ CHECK ENGINE LIGHT ON' : '✓ NO FAULT CODES'}
                </div>
                <div style="font-size: 14px; margin-top: 4px; opacity: 0.9;">
                    ${this.dtcCount} stored trouble code(s)
                </div>
            `;
            container.appendChild(milDiv);
            
            // Monitor list
            const monitorNames = {
                misfire: 'Misfire Monitor',
                fuelSystem: 'Fuel System Monitor',
                components: 'Comprehensive Components',
                catalyst: 'Catalyst Monitor',
                heatedCatalyst: 'Heated Catalyst',
                evapSystem: 'EVAP System',
                secondaryAir: 'Secondary Air System',
                oxygenSensor: 'O2 Sensor Monitor',
                oxygenSensorHeater: 'O2 Sensor Heater',
                egrSystem: 'EGR System'
            };
            
            Object.keys(this.monitors).forEach(key => {
                const monitor = this.monitors[key];
                if (!monitor.supported) return;
                
                const monitorDiv = document.createElement('div');
                monitorDiv.className = 'readiness-monitor';
                monitorDiv.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px;
                    background: white;
                    border-radius: 6px;
                    margin-bottom: 8px;
                    border-left: 4px solid ${monitor.complete ? 'var(--green)' : 'var(--orange)'};
                `;
                
                monitorDiv.innerHTML = `
                    <span style="font-size: 14px; font-weight: 600;">${monitorNames[key]}</span>
                    <span style="
                        font-size: 12px;
                        padding: 4px 12px;
                        border-radius: 4px;
                        background: ${monitor.complete ? 'var(--green)' : 'var(--orange)'};
                        color: white;
                        font-weight: 700;
                    ">
                        ${monitor.complete ? '✓ READY' : 'NOT READY'}
                    </span>
                `;
                
                container.appendChild(monitorDiv);
            });
            
            // Inspection readiness summary
            const readyCount = Object.values(this.monitors)
                .filter(m => m.supported && m.complete).length;
            const totalCount = Object.values(this.monitors)
                .filter(m => m.supported).length;
            
            const summaryDiv = document.createElement('div');
            summaryDiv.style.cssText = `
                margin-top: 16px;
                padding: 12px;
                background: rgba(255,255,255,0.5);
                border-radius: 6px;
                text-align: center;
            `;
            
            const allReady = readyCount === totalCount && !this.milStatus;
            summaryDiv.innerHTML = `
                <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                    INSPECTION READINESS
                </div>
                <div style="font-size: 18px; font-weight: 700; color: ${allReady ? 'var(--green)' : 'var(--orange)'};">
                    ${allReady ? '✓ PASS' : '⚠️ NOT READY'}
                </div>
                <div style="font-size: 11px; margin-top: 4px; color: #666;">
                    ${readyCount} of ${totalCount} monitors complete
                </div>
            `;
            container.appendChild(summaryDiv);
            
            // Help text
            if (!allReady) {
                const helpDiv = document.createElement('div');
                helpDiv.style.cssText = `
                    margin-top: 12px;
                    padding: 12px;
                    background: rgba(230, 126, 34, 0.1);
                    border-radius: 6px;
                    font-size: 11px;
                    line-height: 1.5;
                    color: #666;
                `;
                helpDiv.innerHTML = `
                    <strong>To complete monitors:</strong><br>
                    • Drive normally for 50-100 miles<br>
                    • Include highway and city driving<br>
                    • Avoid disconnecting battery<br>
                    • Allow vehicle to fully warm up
                `;
                container.appendChild(helpDiv);
            }
        },

        /**
         * Generate simulated status for demo mode
         */
        renderSimulatedStatus() {
            // Simulate mostly ready system with one incomplete monitor
            this.milStatus = false;
            this.dtcCount = 0;
            
            this.monitors = {
                misfire: { supported: true, complete: true },
                fuelSystem: { supported: true, complete: true },
                components: { supported: true, complete: true },
                catalyst: { supported: true, complete: true },
                heatedCatalyst: { supported: true, complete: false }, // Not ready
                evapSystem: { supported: true, complete: true },
                secondaryAir: { supported: false, complete: false },
                acRefrigerant: { supported: false, complete: false },
                oxygenSensor: { supported: true, complete: true },
                oxygenSensorHeater: { supported: true, complete: true },
                egrSystem: { supported: true, complete: true }
            };
            
            this.render();
        },

        /**
         * Shutdown
         */
        shutdown() {
            System.log('Readiness', 'Shutdown complete');
        }
    };

    // Register
    window.System.activeApps.readiness = ReadinessApp;
    ReadinessApp.init();
    
    // Global helper
    window.readMonitorStatus = () => ReadinessApp.readStatus();
})();

