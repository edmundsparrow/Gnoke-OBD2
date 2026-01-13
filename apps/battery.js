/**
 * Gnokestation Battery & Charging System Monitor v3.0
 * Production-ready module for electrical system health monitoring
 * 
 * Features:
 * - Control module voltage monitoring (PID 0142)
 * - Intelligent charging system diagnostics
 * - Battery health trending and alerts
 * - Voltage drop detection under load
 * - Alternator performance analysis
 */

(() => {
    const BatteryApp = {
        id: 'battery',
        updateInterval: null,
        pollingRate: 5000, // 0.2Hz - battery voltage changes very slowly
        isActive: false,
        
        // Feature detection and state
        supported: true,
        consecutiveErrors: 0,
        maxErrors: 3,
        
        // Historical data for trend analysis
        voltageHistory: [],
        maxHistoryLength: 20,
        
        // Diagnostic thresholds (volts)
        thresholds: {
            criticalLow: 11.8,
            warningLow: 12.0,
            normalLow: 12.4,
            normalHigh: 14.8,
            warningHigh: 15.0,
            criticalHigh: 15.5
        },
        
        // State tracking
        lastAlertVoltage: null,
        engineRunning: false,

        /**
         * Initialize module
         */
        init() {
            System.log('Battery', 'Initializing Battery Monitor...');
            
            this.updateInterval = setInterval(() => this.tick(), this.pollingRate);
            
            System.log('Battery', `✓ Ready (${this.pollingRate}ms polling)`);
        },

        /**
         * Intelligent polling cycle
         */
        async tick() {
            const isDashVisible = document.getElementById('dash')?.classList.contains('active');
            const isConnected = window.obd?.connected || window.isSimulating;
            
            if (!isDashVisible || !isConnected || !this.isActive) return;
            
            if (this.consecutiveErrors >= this.maxErrors) {
                if (this.consecutiveErrors === this.maxErrors) {
                    System.log('Battery', 'Module disabled - PID 0142 not supported');
                    this.consecutiveErrors++;
                }
                return;
            }

            await this.update();
        },

        /**
         * Main update cycle
         */
        async update() {
            if (window.isSimulating) {
                this.render(this.generateSimData());
                return;
            }

            try {
                const voltage = await this.fetchVoltage();
                if (voltage !== null) {
                    this.render(voltage);
                    this.analyze(voltage);
                    this.consecutiveErrors = 0;
                }
            } catch (err) {
                this.consecutiveErrors++;
                System.log('Battery', `Poll error (${this.consecutiveErrors}/${this.maxErrors}): ${err.message}`);
            }
        },

        /**
         * Fetch battery voltage from hardware
         */
        async fetchVoltage() {
            if (!this.supported) return null;

            try {
                const raw = await window.obd.sendCommand(PIDS.BATTERY.code);
                const bytes = window.parseOBDResponse(raw, '4142');
                const voltage = PIDS.BATTERY.parse(bytes);
                
                if (voltage !== null) {
                    // Add to history
                    this.voltageHistory.push(voltage);
                    if (this.voltageHistory.length > this.maxHistoryLength) {
                        this.voltageHistory.shift();
                    }
                }
                
                return voltage;
            } catch (err) {
                this.supported = false;
                System.log('Battery', 'PID 0142 not supported by vehicle');
                return null;
            }
        },

        /**
         * Update UI with battery data
         */
        render(voltage) {
            if (voltage === null) return;

            // Update numeric display
            const battValEl = document.getElementById('batt-val');
            if (battValEl) {
                battValEl.textContent = voltage.toFixed(2);
            }

            // Update circular gauge
            const battRing = document.getElementById('batt-ring');
            if (battRing) {
                // Map voltage to percentage (11V = 0%, 15V = 100%)
                const minV = 11;
                const maxV = 15;
                const percentage = Math.min(Math.max((voltage - minV) / (maxV - minV), 0), 1);
                const circumference = 157;
                const dasharray = `${circumference * percentage} ${circumference}`;
                battRing.setAttribute('stroke-dasharray', dasharray);
                
                // Color code by health
                if (voltage < this.thresholds.criticalLow || voltage > this.thresholds.criticalHigh) {
                    battRing.setAttribute('stroke', 'var(--red)');
                } else if (voltage < this.thresholds.warningLow || voltage > this.thresholds.warningHigh) {
                    battRing.setAttribute('stroke', 'var(--orange)');
                } else {
                    battRing.setAttribute('stroke', 'var(--green)');
                }
            }

            // Update text color
            if (battValEl) {
                if (voltage < this.thresholds.criticalLow || voltage > this.thresholds.criticalHigh) {
                    battValEl.style.color = 'var(--red)';
                } else if (voltage < this.thresholds.warningLow || voltage > this.thresholds.warningHigh) {
                    battValEl.style.color = 'var(--orange)';
                } else {
                    battValEl.style.color = 'var(--accent)';
                }
            }
        },

        /**
         * Intelligent battery system analysis
         */
        analyze(voltage) {
            if (voltage === null) return;

            // Determine if engine is likely running based on voltage
            // Running: typically 13.5-14.8V (alternator charging)
            // Off: typically 12.4-12.8V (battery only)
            const wasRunning = this.engineRunning;
            this.engineRunning = voltage > 13.2;

            // Critical alerts (avoid spam by checking if voltage changed significantly)
            const significantChange = !this.lastAlertVoltage || 
                                     Math.abs(voltage - this.lastAlertVoltage) > 0.5;

            if (voltage < this.thresholds.criticalLow && significantChange) {
                System.log('Battery', `🚨 CRITICAL: Battery voltage critically low at ${voltage.toFixed(2)}V`);
                System.log('Battery', 'Immediate attention required - vehicle may not restart');
                this.lastAlertVoltage = voltage;
            } else if (voltage > this.thresholds.criticalHigh && significantChange) {
                System.log('Battery', `🚨 CRITICAL: Overcharge detected at ${voltage.toFixed(2)}V`);
                System.log('Battery', 'Alternator voltage regulator may be faulty');
                this.lastAlertVoltage = voltage;
            }

            // Warning alerts
            if (voltage < this.thresholds.warningLow && voltage >= this.thresholds.criticalLow && significantChange) {
                System.log('Battery', `⚠️ Low voltage: ${voltage.toFixed(2)}V`);
                if (this.engineRunning) {
                    System.log('Battery', 'Alternator may not be charging properly');
                } else {
                    System.log('Battery', 'Battery may need charging or replacement');
                }
                this.lastAlertVoltage = voltage;
            }

            // Charging system diagnostics
            if (this.engineRunning && voltage < 13.2) {
                System.log('Battery', `⚠️ Poor charging: ${voltage.toFixed(2)}V while engine running`);
                System.log('Battery', 'Check alternator, belt tension, and connections');
            }

            // Detect engine start (voltage jump from ~12.5V to ~14V)
            if (this.engineRunning && !wasRunning && this.voltageHistory.length > 2) {
                const prevVoltage = this.voltageHistory[this.voltageHistory.length - 2];
                const voltageRise = voltage - prevVoltage;
                if (voltageRise > 1.0) {
                    System.log('Battery', `Engine started - voltage rose ${voltageRise.toFixed(2)}V`);
                }
            }

            // Voltage drop detection (possible high load or failing alternator)
            if (this.voltageHistory.length >= 3) {
                const recentAvg = this.voltageHistory.slice(-3).reduce((a, b) => a + b) / 3;
                const historicalAvg = this.voltageHistory.slice(0, -3).reduce((a, b) => a + b) / (this.voltageHistory.length - 3);
                
                if (this.engineRunning && recentAvg < historicalAvg - 0.5) {
                    System.log('Battery', `Voltage trending down: ${recentAvg.toFixed(2)}V (was ${historicalAvg.toFixed(2)}V)`);
                }
            }

            // Battery health assessment
            if (!this.engineRunning && voltage >= this.thresholds.normalLow) {
                // Good resting voltage
                const health = voltage >= 12.6 ? 'Excellent' : 
                              voltage >= 12.4 ? 'Good' : 'Fair';
                // Only log periodically to avoid spam
                if (this.voltageHistory.length === this.maxHistoryLength) {
                    System.log('Battery', `Battery health: ${health} (${voltage.toFixed(2)}V resting)`);
                }
            }
        },

        /**
         * Generate simulated data for demo mode
         */
        generateSimData() {
            // Simulate running engine with slight voltage fluctuation
            return 14.1 + (Math.random() * 0.4 - 0.2); // 13.9-14.5V typical
        },

        /**
         * Quick poll for dashboard integration
         * Returns data without full analysis cycle
         */
        async quickPoll() {
            if (window.isSimulating) {
                return { voltage: this.generateSimData() };
            }

            try {
                const voltage = await this.fetchVoltage();
                return { voltage };
            } catch (err) {
                return { voltage: null };
            }
        },

        /**
         * Get battery status summary
         */
        getStatus() {
            if (this.voltageHistory.length === 0) {
                return 'No data';
            }

            const latestVoltage = this.voltageHistory[this.voltageHistory.length - 1];
            
            if (latestVoltage < this.thresholds.criticalLow) {
                return 'Critical';
            } else if (latestVoltage > this.thresholds.criticalHigh) {
                return 'Overcharge';
            } else if (latestVoltage < this.thresholds.warningLow) {
                return 'Low';
            } else if (latestVoltage > this.thresholds.warningHigh) {
                return 'High';
            } else {
                return 'Normal';
            }
        },

        /**
         * Activate module
         */
        activate() {
            this.isActive = true;
            System.log('Battery', 'Module activated');
        },

        /**
         * Deactivate module
         */
        deactivate() {
            this.isActive = false;
            System.log('Battery', 'Module deactivated');
        },

        /**
         * Shutdown cleanup
         */
        shutdown() {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
            this.isActive = false;
            this.consecutiveErrors = 0;
            this.voltageHistory = [];
            this.lastAlertVoltage = null;
            this.engineRunning = false;
            System.log('Battery', 'Shutdown complete');
        }
    };

    // Register and initialize
    window.System.activeApps.battery = BatteryApp;
    BatteryApp.init();
})();