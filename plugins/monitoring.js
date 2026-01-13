/**
 * Gnokestation On-Board Monitoring (Mode 06) v1.0
 * File: monitoring.js
 * 
 * THE DEEP TECH MODE - Raw component test data before codes trigger
 * 
 * What is Mode 06?
 * While Mode 01 gives you "current values" and Mode 03 gives you "fault codes",
 * Mode 06 shows you the ACTUAL TEST RESULTS that determine if a code will trigger.
 * 
 * Example: Catalyst Monitor
 * - Test ID: $01 (Catalyst efficiency)
 * - Limit: 0.500 (threshold for P0420)
 * - Current Value: 0.485 (still passing, but close!)
 * 
 * This is CRITICAL for:
 * - Predicting failures before they happen
 * - Verifying repairs (did values improve?)
 * - Professional diagnostics
 * - Passing emissions tests
 * 
 * Why technicians love Mode 06:
 * "The customer says their cat is fine, but Mode 06 shows 0.498 - 
 *  it's 2% away from failure. Time to replace it."
 */

(() => {
    const MonitoringApp = {
        id: 'monitoring',
        
        // Monitor test results
        testResults: [],
        
        // Test ID database (varies by manufacturer, these are common)
        testIDs: {
            // Catalyst Monitor (TID $01)
            '0100': { name: 'Catalyst Monitor Bank 1', unit: 'ratio', description: 'Catalyst efficiency ratio' },
            '0200': { name: 'Catalyst Monitor Bank 2', unit: 'ratio', description: 'Catalyst efficiency ratio' },
            
            // Oxygen Sensor Monitor (TID $05-$08)
            '0501': { name: 'O2 Sensor Bank 1 Sensor 1', unit: 'V', description: 'Rich to lean sensor threshold' },
            '0502': { name: 'O2 Sensor Bank 1 Sensor 2', unit: 'V', description: 'Rich to lean sensor threshold' },
            '0601': { name: 'O2 Sensor Bank 2 Sensor 1', unit: 'V', description: 'Rich to lean sensor threshold' },
            '0602': { name: 'O2 Sensor Bank 2 Sensor 2', unit: 'V', description: 'Rich to lean sensor threshold' },
            
            // EGR Monitor (TID $03)
            '0300': { name: 'EGR System Monitor', unit: '%', description: 'EGR flow test' },
            
            // EVAP Monitor (TID $0A)
            '0A00': { name: 'EVAP System Leak', unit: 'kPa', description: 'Vapor pressure' },
            
            // Misfire Monitor (TID $0B)
            '0B01': { name: 'Misfire Cylinder 1', unit: 'count', description: 'Misfire events' },
            '0B02': { name: 'Misfire Cylinder 2', unit: 'count', description: 'Misfire events' },
            '0B03': { name: 'Misfire Cylinder 3', unit: 'count', description: 'Misfire events' },
            '0B04': { name: 'Misfire Cylinder 4', unit: 'count', description: 'Misfire events' },
            '0B05': { name: 'Misfire Cylinder 5', unit: 'count', description: 'Misfire events' },
            '0B06': { name: 'Misfire Cylinder 6', unit: 'count', description: 'Misfire events' },
            
            // Fuel System Monitor (TID $21)
            '2100': { name: 'Fuel System Rich/Lean', unit: '%', description: 'Fuel trim deviation' }
        },

        /**
         * Initialize Mode 06 reader
         */
        init() {
            System.log('Monitoring', 'Initializing On-Board Monitoring...');
            System.log('Monitoring', '✓ Ready - Deep diagnostics available');
        },

        /**
         * Read all available Mode 06 test results
         */
        async readTestResults() {
            if (window.isSimulating) {
                this.renderSimulatedResults();
                return;
            }

            try {
                System.log('Monitoring', 'Reading on-board test results...');
                
                const container = document.getElementById('monitoring-list');
                if (container) {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 40px; color: #666;">
                            <div style="font-size: 48px; margin-bottom: 12px;">🔬</div>
                            <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">
                                Scanning Component Tests...
                            </div>
                            <div style="font-size: 12px;">This may take 30-60 seconds</div>
                        </div>
                    `;
                }
                
                this.testResults = [];
                
                // Request Mode 06 data
                // Format: 0600 (request all test results)
                const raw = await window.obd.sendCommand('0600');
                
                // Parse response
                this.parseTestResults(raw);
                
                // If no results, try specific test IDs
                if (this.testResults.length === 0) {
                    await this.scanSpecificTests();
                }
                
                this.render();
                
                System.log('Monitoring', `✓ Retrieved ${this.testResults.length} test results`);
                
            } catch (err) {
                System.log('Monitoring', `Error: ${err.message}`);
                const container = document.getElementById('monitoring-list');
                if (container) {
                    container.innerHTML = `
                        <div style="background: rgba(195, 51, 51, 0.1); padding: 20px; border-radius: 8px; text-align: center;">
                            <div style="font-size: 14px; font-weight: 600; color: var(--red); margin-bottom: 8px;">
                                ⚠️ Mode 06 Not Supported
                            </div>
                            <div style="font-size: 12px; color: #666; line-height: 1.5;">
                                Your vehicle may not support Mode 06 test results,<br>
                                or the feature requires a more recent drive cycle.<br><br>
                                Try driving for 10-15 minutes and scanning again.
                            </div>
                        </div>
                    `;
                }
            }
        },

        /**
         * Parse Mode 06 response
         * Format is complex and manufacturer-specific
         */
        parseTestResults(hex) {
            const bytes = window.parseOBDResponse(hex, '4600');
            if (!bytes || bytes.length < 4) return;

            // Mode 06 format (simplified):
            // TID (Test ID) - 1 byte
            // COMP ID (Component ID) - 1 byte
            // MIN - 2 bytes
            // MAX - 2 bytes
            // VALUE - 2 bytes
            
            let i = 0;
            while (i < bytes.length - 6) {
                const tid = bytes[i].toString(16).padStart(2, '0');
                const compid = bytes[i + 1].toString(16).padStart(2, '0');
                const testKey = tid + compid;
                
                // Parse test values (2 bytes each, signed)
                const minValue = this.parseSignedInt16(bytes[i + 2], bytes[i + 3]);
                const maxValue = this.parseSignedInt16(bytes[i + 4], bytes[i + 5]);
                const currentValue = this.parseSignedInt16(bytes[i + 6], bytes[i + 7]);
                
                // Scaling factor (manufacturer-specific, simplified here)
                const scale = 0.001; // Common for catalyst monitors
                
                const testInfo = this.testIDs[testKey] || {
                    name: `Test ${tid} Component ${compid}`,
                    unit: 'units',
                    description: 'Unknown test'
                };
                
                // Calculate how close to failure
                const range = maxValue - minValue;
                const position = currentValue - minValue;
                const percentToLimit = range > 0 ? (position / range) * 100 : 0;
                
                this.testResults.push({
                    testID: tid,
                    componentID: compid,
                    name: testInfo.name,
                    description: testInfo.description,
                    unit: testInfo.unit,
                    min: minValue * scale,
                    max: maxValue * scale,
                    value: currentValue * scale,
                    percentToLimit: percentToLimit,
                    status: this.evaluateTestStatus(percentToLimit)
                });
                
                i += 8; // Move to next test
            }
        },

        /**
         * Parse signed 16-bit integer from 2 bytes
         */
        parseSignedInt16(highByte, lowByte) {
            const value = (highByte << 8) | lowByte;
            return value > 32767 ? value - 65536 : value;
        },

        /**
         * Scan specific test IDs if general request fails
         */
        async scanSpecificTests() {
            const commonTests = ['01', '03', '05', '0A', '0B'];
            
            for (const tid of commonTests) {
                try {
                    const raw = await window.obd.sendCommand(`06${tid}`);
                    this.parseTestResults(raw);
                } catch (err) {
                    // Test not available, continue
                }
            }
        },

        /**
         * Evaluate test status based on proximity to limit
         */
        evaluateTestStatus(percentToLimit) {
            if (percentToLimit < 50) {
                return { level: 'excellent', label: '✓ Excellent', color: 'var(--green)' };
            } else if (percentToLimit < 75) {
                return { level: 'good', label: '✓ Good', color: 'var(--blue)' };
            } else if (percentToLimit < 90) {
                return { level: 'fair', label: '⚠️ Fair', color: 'var(--orange)' };
            } else {
                return { level: 'warning', label: '⚠️ Near Limit', color: 'var(--red)' };
            }
        },

        /**
         * Render test results to UI
         */
        render() {
            const container = document.getElementById('monitoring-list');
            if (!container) return;

            if (this.testResults.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <div style="font-size: 48px; margin-bottom: 12px;">🔬</div>
                        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">
                            No Test Results Available
                        </div>
                        <div style="font-size: 12px; line-height: 1.5;">
                            Drive the vehicle through a complete drive cycle<br>
                            to generate test results.
                        </div>
                    </div>
                `;
                return;
            }

            // Group by test type
            const grouped = {};
            this.testResults.forEach(result => {
                const category = this.getCategoryFromTestID(result.testID);
                if (!grouped[category]) grouped[category] = [];
                grouped[category].push(result);
            });

            let html = '';
            
            Object.keys(grouped).forEach(category => {
                html += `
                    <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
                        <div style="font-size: 13px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; opacity: 0.7;">
                            ${category}
                        </div>
                `;
                
                grouped[category].forEach(result => {
                    html += this.renderTestCard(result);
                });
                
                html += '</div>';
            });

            // Add help text
            html += `
                <div style="margin-top: 12px; padding: 12px; background: rgba(52, 152, 219, 0.1); border-radius: 6px; font-size: 11px; line-height: 1.5; color: #666;">
                    <strong>💡 Understanding Mode 06:</strong><br>
                    • <strong>Green/Blue:</strong> Component healthy, passing with margin<br>
                    • <strong>Orange:</strong> Component passing but approaching limit<br>
                    • <strong>Red:</strong> Component very close to failure threshold<br><br>
                    Values closer to MAX mean the component is degrading.
                </div>
            `;

            container.innerHTML = html;
        },

        /**
         * Render individual test result card
         */
        renderTestCard(result) {
            return `
                <div style="
                    padding: 12px;
                    margin-bottom: 8px;
                    background: rgba(0,0,0,0.02);
                    border-radius: 6px;
                    border-left: 4px solid ${result.status.color};
                ">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div>
                            <div style="font-size: 13px; font-weight: 600; color: var(--accent);">
                                ${result.name}
                            </div>
                            <div style="font-size: 10px; color: #666; margin-top: 2px;">
                                ${result.description}
                            </div>
                        </div>
                        <div style="
                            font-size: 11px;
                            padding: 4px 8px;
                            border-radius: 4px;
                            background: ${result.status.color};
                            color: white;
                            font-weight: 700;
                            white-space: nowrap;
                        ">
                            ${result.status.label}
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 11px;">
                        <div>
                            <div style="opacity: 0.6; margin-bottom: 2px;">MIN</div>
                            <div style="font-weight: 700;">${result.min.toFixed(3)} ${result.unit}</div>
                        </div>
                        <div>
                            <div style="opacity: 0.6; margin-bottom: 2px;">CURRENT</div>
                            <div style="font-weight: 700; color: ${result.status.color};">
                                ${result.value.toFixed(3)} ${result.unit}
                            </div>
                        </div>
                        <div>
                            <div style="opacity: 0.6; margin-bottom: 2px;">MAX</div>
                            <div style="font-weight: 700;">${result.max.toFixed(3)} ${result.unit}</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 8px;">
                        <div style="height: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; overflow: hidden;">
                            <div style="
                                height: 100%;
                                width: ${result.percentToLimit}%;
                                background: ${result.status.color};
                                transition: width 0.3s;
                            "></div>
                        </div>
                        <div style="font-size: 10px; text-align: right; margin-top: 2px; opacity: 0.6;">
                            ${result.percentToLimit.toFixed(1)}% to limit
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * Get category name from test ID
         */
        getCategoryFromTestID(tid) {
            const categories = {
                '01': '🔥 Catalyst System',
                '02': '🔥 Catalyst System',
                '03': '💨 EGR System',
                '05': '🌡️ Oxygen Sensors',
                '06': '🌡️ Oxygen Sensors',
                '0A': '💧 EVAP System',
                '0B': '⚡ Misfire Monitor',
                '21': '⛽ Fuel System'
            };
            return categories[tid] || '🔧 Other Tests';
        },

        /**
         * Generate simulated test results for demo mode
         */
        renderSimulatedResults() {
            // Simulate realistic test results
            this.testResults = [
                {
                    testID: '01',
                    componentID: '00',
                    name: 'Catalyst Monitor Bank 1',
                    description: 'Catalyst efficiency ratio',
                    unit: 'ratio',
                    min: 0.000,
                    max: 0.500,
                    value: 0.387,
                    percentToLimit: 77.4,
                    status: { level: 'fair', label: '⚠️ Fair', color: 'var(--orange)' }
                },
                {
                    testID: '05',
                    componentID: '01',
                    name: 'O2 Sensor Bank 1 Sensor 1',
                    description: 'Rich to lean sensor threshold',
                    unit: 'V',
                    min: 0.100,
                    max: 0.900,
                    value: 0.450,
                    percentToLimit: 43.8,
                    status: { level: 'excellent', label: '✓ Excellent', color: 'var(--green)' }
                },
                {
                    testID: '03',
                    componentID: '00',
                    name: 'EGR System Monitor',
                    description: 'EGR flow test',
                    unit: '%',
                    min: 0.0,
                    max: 100.0,
                    value: 45.2,
                    percentToLimit: 45.2,
                    status: { level: 'excellent', label: '✓ Excellent', color: 'var(--green)' }
                },
                {
                    testID: '0B',
                    componentID: '01',
                    name: 'Misfire Cylinder 1',
                    description: 'Misfire events',
                    unit: 'count',
                    min: 0,
                    max: 50,
                    value: 42,
                    percentToLimit: 84.0,
                    status: { level: 'warning', label: '⚠️ Near Limit', color: 'var(--red)' }
                }
            ];

            this.render();
            System.log('Monitoring', '✓ Demo test results loaded');
        },

        /**
         * Export test results
         */
        exportResults() {
            if (this.testResults.length === 0) {
                alert('No test results to export');
                return;
            }

            const exportData = {
                timestamp: new Date().toISOString(),
                vehicleInfo: {
                    // Could include VIN if available
                },
                testResults: this.testResults.map(r => ({
                    test: r.name,
                    testID: r.testID,
                    componentID: r.componentID,
                    min: r.min,
                    max: r.max,
                    current: r.value,
                    unit: r.unit,
                    status: r.status.label,
                    percentToLimit: r.percentToLimit
                }))
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], 
                                 { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mode06-results-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);

            System.log('Monitoring', 'Test results exported');
        },

        /**
         * Shutdown
         */
        shutdown() {
            System.log('Monitoring', 'Shutdown complete');
        }
    };

    // Register
    window.System.activeApps.monitoring = MonitoringApp;
    MonitoringApp.init();

    // Global helpers
    window.readMonitoring = () => MonitoringApp.readTestResults();
    window.exportMonitoring = () => MonitoringApp.exportResults();
})();

