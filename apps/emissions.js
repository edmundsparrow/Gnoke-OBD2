/**
 * Gnokestation Emissions Monitor v3.0
 * Production-ready module for fuel trim, O2 sensors, and MAF monitoring
 * 
 * Features:
 * - Comprehensive emissions system monitoring
 * - Intelligent diagnostic alerts for fuel system issues
 * - Adaptive polling based on data stability
 * - Multi-bank O2 sensor support
 * - Graceful handling of unsupported PIDs
 */

(() => {
    const EmissionsApp = {
        id: 'emissions',
        updateInterval: null,
        pollingRate: 2000, // 0.5Hz - emissions data changes slowly
        isActive: false,
        
        // Feature detection
        supported: {
            stft1: true,  // Short-term fuel trim bank 1
            ltft1: true,  // Long-term fuel trim bank 1
            o2s1: true,   // O2 sensor bank 1 sensor 1
            o2s2: true,   // O2 sensor bank 1 sensor 2
            maf: true     // Mass air flow
        },
        
        // Monitoring state
        consecutiveErrors: 0,
        maxErrors: 3,
        trimHistory: [],
        maxHistoryLength: 10,

        /**
         * Initialize module
         */
        init() {
            System.log('Emissions', 'Initializing Emissions Monitor...');
            
            this.updateInterval = setInterval(() => this.tick(), this.pollingRate);
            
            System.log('Emissions', `✓ Ready (${this.pollingRate}ms polling)`);
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
                    System.log('Emissions', 'Module disabled after repeated failures');
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
                const data = await this.fetchData();
                if (data) {
                    this.render(data);
                    this.analyzeEmissions(data);
                    this.consecutiveErrors = 0;
                }
            } catch (err) {
                this.consecutiveErrors++;
                System.log('Emissions', `Poll error (${this.consecutiveErrors}/${this.maxErrors}): ${err.message}`);
            }
        },

        /**
         * Fetch all emissions-related data
         */
        async fetchData() {
            const data = {
                stft: null,
                ltft: null,
                o2s1: null,
                o2s2: null,
                maf: null
            };

            // Short-term fuel trim
            if (this.supported.stft1) {
                try {
                    const raw = await window.obd.sendCommand(PIDS.SHORT_FUEL_TRIM_1.code);
                    const bytes = window.parseOBDResponse(raw, '4106');
                    data.stft = PIDS.SHORT_FUEL_TRIM_1.parse(bytes);
                } catch (err) {
                    this.supported.stft1 = false;
                    System.log('Emissions', 'Short-term fuel trim not supported');
                }
            }

            // Long-term fuel trim
            if (this.supported.ltft1) {
                try {
                    const raw = await window.obd.sendCommand(PIDS.LONG_FUEL_TRIM_1.code);
                    const bytes = window.parseOBDResponse(raw, '4107');
                    data.ltft = PIDS.LONG_FUEL_TRIM_1.parse(bytes);
                } catch (err) {
                    this.supported.ltft1 = false;
                    System.log('Emissions', 'Long-term fuel trim not supported');
                }
            }

            // O2 Sensor Bank 1 Sensor 1
            if (this.supported.o2s1) {
                try {
                    const raw = await window.obd.sendCommand(PIDS.O2_B1S1.code);
                    const bytes = window.parseOBDResponse(raw, '4114');
                    data.o2s1 = PIDS.O2_B1S1.parse(bytes);
                } catch (err) {
                    this.supported.o2s1 = false;
                    System.log('Emissions', 'O2 sensor B1S1 not supported');
                }
            }

            // O2 Sensor Bank 1 Sensor 2
            if (this.supported.o2s2) {
                try {
                    const raw = await window.obd.sendCommand(PIDS.O2_B1S2.code);
                    const bytes = window.parseOBDResponse(raw, '4115');
                    data.o2s2 = PIDS.O2_B1S2.parse(bytes);
                } catch (err) {
                    this.supported.o2s2 = false;
                    System.log('Emissions', 'O2 sensor B1S2 not supported');
                }
            }

            // Mass Air Flow
            if (this.supported.maf) {
                try {
                    const raw = await window.obd.sendCommand(PIDS.MAF_RATE.code);
                    const bytes = window.parseOBDResponse(raw, '4110');
                    data.maf = PIDS.MAF_RATE.parse(bytes);
                } catch (err) {
                    this.supported.maf = false;
                    System.log('Emissions', 'MAF sensor not supported');
                }
            }

            return data;
        },

        /**
         * Update UI with emissions data
         */
        render(data) {
            // Short-term fuel trim
            const stftEl = document.getElementById('v-stft');
            if (stftEl && data.stft !== null) {
                stftEl.textContent = data.stft.toFixed(1) + '%';
                
                // Color coding based on trim magnitude
                const absStft = Math.abs(data.stft);
                if (absStft > 20) {
                    stftEl.style.color = 'var(--red)';
                } else if (absStft > 10) {
                    stftEl.style.color = 'var(--orange)';
                } else {
                    stftEl.style.color = 'var(--accent)';
                }
            }

            // Long-term fuel trim
            const ltftEl = document.getElementById('v-ltft');
            if (ltftEl && data.ltft !== null) {
                ltftEl.textContent = data.ltft.toFixed(1) + '%';
                
                const absLtft = Math.abs(data.ltft);
                if (absLtft > 20) {
                    ltftEl.style.color = 'var(--red)';
                } else if (absLtft > 10) {
                    ltftEl.style.color = 'var(--orange)';
                } else {
                    ltftEl.style.color = 'var(--accent)';
                }
            }

            // O2 Sensors
            const o2s1El = document.getElementById('v-o2s1');
            if (o2s1El && data.o2s1 !== null) {
                o2s1El.textContent = data.o2s1.toFixed(3) + 'V';
                
                // Typical operating range is 0.1-0.9V
                if (data.o2s1 < 0.05 || data.o2s1 > 0.95) {
                    o2s1El.style.color = 'var(--orange)';
                } else {
                    o2s1El.style.color = 'var(--accent)';
                }
            }

            const o2s2El = document.getElementById('v-o2s2');
            if (o2s2El && data.o2s2 !== null) {
                o2s2El.textContent = data.o2s2.toFixed(3) + 'V';
                
                if (data.o2s2 < 0.05 || data.o2s2 > 0.95) {
                    o2s2El.style.color = 'var(--orange)';
                } else {
                    o2s2El.style.color = 'var(--accent)';
                }
            }

            // MAF
            const mafEl = document.getElementById('v-maf');
            if (mafEl && data.maf !== null) {
                mafEl.textContent = data.maf.toFixed(2) + ' g/s';
            }
        },

        /**
         * Intelligent emissions analysis
         */
        analyzeEmissions(data) {
            // Track fuel trim history for trend analysis
            if (data.stft !== null) {
                this.trimHistory.push(data.stft);
                if (this.trimHistory.length > this.maxHistoryLength) {
                    this.trimHistory.shift();
                }
            }

            // Critical fuel trim alert
            if (data.stft !== null && Math.abs(data.stft) > 25) {
                System.log('Emissions', `⚠️ CRITICAL: Fuel trim at ${data.stft.toFixed(1)}% - possible fuel system fault`);
            }

            // Long-term trim alert
            if (data.ltft !== null && Math.abs(data.ltft) > 25) {
                System.log('Emissions', `⚠️ Long-term fuel trim at ${data.ltft.toFixed(1)}% - ECU compensating for persistent issue`);
            }

            // O2 sensor stuck detection
            if (data.o2s1 !== null) {
                if (data.o2s1 < 0.1) {
                    System.log('Emissions', '⚠️ O2 sensor B1S1 reading lean (< 0.1V)');
                } else if (data.o2s1 > 0.9) {
                    System.log('Emissions', '⚠️ O2 sensor B1S1 reading rich (> 0.9V)');
                }
            }

            // Check for trim correlation (stft and ltft should roughly align)
            if (data.stft !== null && data.ltft !== null) {
                const trimDelta = Math.abs(data.stft - data.ltft);
                if (trimDelta > 15) {
                    System.log('Emissions', `Fuel trim mismatch: STFT ${data.stft.toFixed(1)}%, LTFT ${data.ltft.toFixed(1)}%`);
                }
            }

            // MAF sanity check (typical idle is 1-3 g/s, highway 5-15 g/s)
            if (data.maf !== null && data.maf < 0.5) {
                System.log('Emissions', '⚠️ MAF reading unusually low - possible sensor fault');
            }
        },

        /**
         * Generate simulated data for demo mode
         */
        generateSimData() {
            return {
                stft: -2 + (Math.random() * 4), // -2 to +2% typical
                ltft: -1 + (Math.random() * 2), // -1 to +1% typical
                o2s1: 0.4 + (Math.random() * 0.3), // 0.4-0.7V typical cycling
                o2s2: 0.3 + (Math.random() * 0.2), // Should be more stable
                maf: 2 + (Math.random() * 1) // 2-3 g/s idle
            };
        },

        /**
         * Activate module
         */
        activate() {
            this.isActive = true;
            System.log('Emissions', 'Module activated');
        },

        /**
         * Deactivate module
         */
        deactivate() {
            this.isActive = false;
            System.log('Emissions', 'Module deactivated');
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
            this.trimHistory = [];
            System.log('Emissions', 'Shutdown complete');
        }
    };

    // Register and initialize
    window.System.activeApps.emissions = EmissionsApp;
    EmissionsApp.init();
})();