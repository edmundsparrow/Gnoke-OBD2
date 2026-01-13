/**
 * Gnokestation Freeze Frame Data v1.0
 * 
 * What is Freeze Frame?
 * When a DTC occurs, the ECU captures a "snapshot" of all sensor values
 * at that exact moment. This is CRITICAL for diagnosing intermittent faults.
 * 
 * Example: "P0420 Catalyst Efficiency Below Threshold"
 * - What was the RPM when it occurred?
 * - What was the engine load?
 * - What was the coolant temperature?
 * - What were the O2 sensor voltages?
 * 
 * This data tells you the CONDITIONS that caused the fault.
 */

(() => {
    const FreezeFrameApp = {
        id: 'freezeframe',
        
        // Stored freeze frames
        freezeFrames: [],
        
        // Current selected frame
        selectedFrame: null,

        /**
         * Initialize freeze frame reader
         */
        init() {
            System.log('FreezeFrame', 'Initializing Freeze Frame Reader...');
            System.log('FreezeFrame', '✓ Ready');
        },

        /**
         * Read freeze frame data (Mode 02)
         * Mode 02 uses same PID codes as Mode 01, but returns stored snapshot
         */
        async readFreezeFrame(dtcCode = null) {
            if (window.isSimulating) {
                this.renderSimulatedFreezeFrame();
                return;
            }

            try {
                System.log('FreezeFrame', 'Reading freeze frame data...');
                
                // First, check if freeze frame data exists (Mode 02 PID 00)
                const availableRaw = await window.obd.sendCommand('0200');
                const available = window.parseOBDResponse(availableRaw, '4200');
                
                if (!available) {
                    throw new Error('No freeze frame data available');
                }
                
                // Read freeze frame for common PIDs
                const frame = {
                    dtc: dtcCode || 'Unknown',
                    timestamp: new Date(),
                    data: {}
                };
                
                // Request key PIDs from freeze frame
                const pidsToRead = [
                    { code: '020C', name: 'RPM', pid: PIDS.RPM },
                    { code: '020D', name: 'SPEED', pid: PIDS.SPEED },
                    { code: '0205', name: 'COOLANT', pid: PIDS.COOLANT },
                    { code: '0204', name: 'ENGINE_LOAD', pid: PIDS.ENGINE_LOAD },
                    { code: '0206', name: 'SHORT_FUEL_TRIM', pid: PIDS.SHORT_FUEL_TRIM_1 },
                    { code: '020E', name: 'TIMING', pid: PIDS.TIMING_ADVANCE },
                    { code: '0210', name: 'MAF', pid: PIDS.MAF_RATE },
                    { code: '0214', name: 'O2_SENSOR', pid: PIDS.O2_B1S1 }
                ];
                
                for (const pidInfo of pidsToRead) {
                    try {
                        const raw = await window.obd.sendCommand(pidInfo.code);
                        const bytes = window.parseOBDResponse(raw, '42' + pidInfo.code.substring(2));
                        const value = pidInfo.pid.parse(bytes);
                        
                        if (value !== null) {
                            frame.data[pidInfo.name] = {
                                value: value,
                                unit: pidInfo.pid.unit
                            };
                        }
                    } catch (err) {
                        // PID not available in freeze frame, skip
                    }
                }
                
                this.freezeFrames.push(frame);
                this.selectedFrame = frame;
                this.render();
                
                System.log('FreezeFrame', `✓ Freeze frame captured for ${dtcCode || 'fault'}`);
                
            } catch (err) {
                System.log('FreezeFrame', `Error: ${err.message}`);
                alert('No freeze frame data available.\n\nFreeze frame is only stored when a fault first occurs.');
            }
        },

        /**
         * Render freeze frame data to UI
         */
        render() {
            const container = document.getElementById('freezeframe-content');
            if (!container) return;
            
            if (!this.selectedFrame) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <div style="font-size: 48px; margin-bottom: 12px;">📸</div>
                        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">
                            No Freeze Frame Data
                        </div>
                        <div style="font-size: 12px; line-height: 1.5;">
                            Freeze frame is captured when a fault occurs.<br>
                            Read DTCs first, then click "View Freeze Frame".
                        </div>
                    </div>
                `;
                return;
            }
            
            const frame = this.selectedFrame;
            
            container.innerHTML = `
                <div style="margin-bottom: 16px; padding: 16px; background: white; border-radius: 8px; border-left: 4px solid var(--red);">
                    <div style="font-size: 16px; font-weight: 700; color: var(--red); margin-bottom: 4px;">
                        ${frame.dtc}
                    </div>
                    <div style="font-size: 11px; color: #666;">
                        Captured: ${frame.timestamp.toLocaleString()}
                    </div>
                </div>
                
                <div style="background: white; border-radius: 8px; padding: 16px;">
                    <div style="font-size: 12px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; opacity: 0.7;">
                        Conditions When Fault Occurred
                    </div>
                    ${this.renderFrameData(frame.data)}
                </div>
                
                <div style="margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.5); border-radius: 6px; font-size: 11px; line-height: 1.5; color: #666;">
                    <strong>💡 Diagnostic Tip:</strong> Compare these values to normal operating conditions. 
                    Unusual readings (high temp, lean fuel trim, low voltage, etc.) indicate the root cause.
                </div>
            `;
        },

        /**
         * Render individual data points
         */
        renderFrameData(data) {
            if (Object.keys(data).length === 0) {
                return '<div style="color: #999; font-size: 12px;">No data available</div>';
            }
            
            let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">';
            
            const labels = {
                'RPM': 'Engine Speed',
                'SPEED': 'Vehicle Speed',
                'COOLANT': 'Coolant Temp',
                'ENGINE_LOAD': 'Engine Load',
                'SHORT_FUEL_TRIM': 'Fuel Trim',
                'TIMING': 'Timing Advance',
                'MAF': 'Air Flow',
                'O2_SENSOR': 'O2 Sensor B1S1'
            };
            
            Object.keys(data).forEach(key => {
                const item = data[key];
                html += `
                    <div style="padding: 10px; background: rgba(0,0,0,0.02); border-radius: 6px;">
                        <div style="font-size: 10px; opacity: 0.7; margin-bottom: 4px; font-weight: 600;">
                            ${labels[key] || key}
                        </div>
                        <div style="font-size: 20px; font-weight: 700; color: var(--accent);">
                            ${typeof item.value === 'number' ? item.value.toFixed(1) : item.value}
                            <span style="font-size: 12px; opacity: 0.6; font-weight: 400;">${item.unit || ''}</span>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            return html;
        },

        /**
         * Generate simulated freeze frame for demo
         */
        renderSimulatedFreezeFrame() {
            // Simulate a P0420 (Catalyst Efficiency) freeze frame
            // Show conditions that might cause cat efficiency fault
            this.selectedFrame = {
                dtc: 'P0420 - Catalyst System Efficiency Below Threshold',
                timestamp: new Date(Date.now() - 3600000), // 1 hour ago
                data: {
                    'RPM': { value: 2450, unit: 'RPM' },
                    'SPEED': { value: 85, unit: 'km/h' },
                    'COOLANT': { value: 92, unit: '°C' },
                    'ENGINE_LOAD': { value: 45.2, unit: '%' },
                    'SHORT_FUEL_TRIM': { value: -3.1, unit: '%' },
                    'TIMING': { value: 12.5, unit: '°' },
                    'MAF': { value: 8.7, unit: 'g/s' },
                    'O2_SENSOR': { value: 0.65, unit: 'V' }
                }
            };
            
            this.freezeFrames.push(this.selectedFrame);
            this.render();
            
            System.log('FreezeFrame', '✓ Demo freeze frame loaded');
        },

        /**
         * Clear all freeze frames
         */
        clear() {
            this.freezeFrames = [];
            this.selectedFrame = null;
            this.render();
            System.log('FreezeFrame', 'Freeze frames cleared');
        },

        /**
         * Export freeze frame data
         */
        exportFrame() {
            if (!this.selectedFrame) {
                alert('No freeze frame to export');
                return;
            }
            
            const exportData = {
                dtc: this.selectedFrame.dtc,
                timestamp: this.selectedFrame.timestamp.toISOString(),
                conditions: this.selectedFrame.data
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], 
                                 { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `freezeframe-${this.selectedFrame.dtc.split(' ')[0]}-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            System.log('FreezeFrame', 'Freeze frame exported');
        },

        /**
         * Shutdown
         */
        shutdown() {
            System.log('FreezeFrame', 'Shutdown complete');
        }
    };

    // Register
    window.System.activeApps.freezeframe = FreezeFrameApp;
    FreezeFrameApp.init();
    
    // Global helpers
    window.readFreezeFrame = () => FreezeFrameApp.readFreezeFrame();
    window.clearFreezeFrame = () => FreezeFrameApp.clear();
    window.exportFreezeFrame = () => FreezeFrameApp.exportFrame();
})();

