/**
 * Gnokestation Engine Performance Monitor v3.0
 * 
 * Purpose: Advanced engine analysis and performance tracking
 * Features not covered by basic dashboard:
 * - Manifold pressure (MAP/boost)
 * - Intake air temperature
 * - Mass air flow
 * - Calculated horsepower estimation
 * - Peak performance tracking
 * - Acceleration timing (0-60, quarter mile)
 * - Efficiency metrics
 * 
 * This module provides a dedicated "Engine" view for enthusiasts
 * and professional tuners who need detailed performance data.
 */

(() => {
    const EngineApp = {
        id: 'engine',
        updateInterval: null,
        pollingRate: 200, // 5Hz for performance metrics
        isActive: false,
        
        // Feature detection
        supported: {
            map: true,      // Manifold pressure
            iat: true,      // Intake air temp
            maf: true,      // Mass air flow
            load: true,     // Engine load
            timing: true,   // Ignition timing
            baro: true      // Barometric pressure
        },
        
        // Performance tracking
        sessionData: {
            startTime: null,
            peakRPM: 0,
            peakSpeed: 0,
            peakLoad: 0,
            peakMAF: 0,
            minTiming: 0,
            maxBoost: 0,
            
            // Acceleration tracking
            accelStartTime: null,
            accelStartSpeed: 0,
            time0to60: null,
            quarterMileTime: null,
            quarterMileSpeed: null
        },
        
        // Recent data for calculations
        recentData: [],
        maxRecentData: 50, // Keep last 5 seconds at 10Hz
        
        consecutiveErrors: 0,
        maxErrors: 3,

        /**
         * Initialize module
         */
        init() {
            System.log('Engine', 'Initializing Advanced Performance Monitor...');
            
            this.updateInterval = setInterval(() => this.tick(), this.pollingRate);
            this.resetSession();
            
            System.log('Engine', `✓ Ready (${this.pollingRate}ms polling)`);
        },

        /**
         * Intelligent polling
         */
        async tick() {
            const isEngineViewVisible = document.getElementById('engine-view')?.classList.contains('active');
            const isConnected = window.obd?.connected || window.isSimulating;
            
            // Always track performance data when connected, but only update UI if view is visible
            if (isConnected && this.isActive && this.consecutiveErrors < this.maxErrors) {
                await this.update(isEngineViewVisible);
            }
        },

        /**
         * Main update cycle
         */
        async update(updateUI = true) {
            if (window.isSimulating) {
                const data = this.generateSimData();
                this.trackPerformance(data);
                if (updateUI) this.render(data);
                return;
            }

            try {
                const data = await this.fetchData();
                if (data) {
                    this.trackPerformance(data);
                    if (updateUI) this.render(data);
                    this.consecutiveErrors = 0;
                }
            } catch (err) {
                this.consecutiveErrors++;
                System.log('Engine', `Poll error (${this.consecutiveErrors}/${this.maxErrors})`);
            }
        },

        /**
         * Fetch all engine performance data
         */
        async fetchData() {
            const data = {
                rpm: null,
                speed: null,
                load: null,
                timing: null,
                iat: null,
                maf: null,
                map: null,
                baro: null,
                timestamp: Date.now()
            };

            // Get RPM and Speed (always needed for calculations)
            try {
                const rpmRaw = await window.obd.sendCommand(PIDS.RPM.code);
                data.rpm = PIDS.RPM.parse(window.parseOBDResponse(rpmRaw, '410C'));
            } catch (err) {}

            try {
                const speedRaw = await window.obd.sendCommand(PIDS.SPEED.code);
                data.speed = PIDS.SPEED.parse(window.parseOBDResponse(speedRaw, '410D'));
            } catch (err) {}

            // Engine Load
            if (this.supported.load) {
                try {
                    const loadRaw = await window.obd.sendCommand(PIDS.ENGINE_LOAD.code);
                    data.load = PIDS.ENGINE_LOAD.parse(window.parseOBDResponse(loadRaw, '4104'));
                } catch (err) {
                    this.supported.load = false;
                }
            }

            // Timing Advance
            if (this.supported.timing) {
                try {
                    const timingRaw = await window.obd.sendCommand(PIDS.TIMING_ADVANCE.code);
                    data.timing = PIDS.TIMING_ADVANCE.parse(window.parseOBDResponse(timingRaw, '410E'));
                } catch (err) {
                    this.supported.timing = false;
                }
            }

            // Intake Air Temperature
            if (this.supported.iat) {
                try {
                    const iatRaw = await window.obd.sendCommand(PIDS.INTAKE_TEMP.code);
                    data.iat = PIDS.INTAKE_TEMP.parse(window.parseOBDResponse(iatRaw, '410F'));
                } catch (err) {
                    this.supported.iat = false;
                }
            }

            // Mass Air Flow
            if (this.supported.maf) {
                try {
                    const mafRaw = await window.obd.sendCommand(PIDS.MAF_RATE.code);
                    data.maf = PIDS.MAF_RATE.parse(window.parseOBDResponse(mafRaw, '4110'));
                } catch (err) {
                    this.supported.maf = false;
                }
            }

            // Note: MAP and BARO are manufacturer-specific PIDs (Mode 01, but varies)
            // Many vehicles don't support these via standard OBD-II

            return data;
        },

        /**
         * Track performance metrics and detect events
         */
        trackPerformance(data) {
            // Add to recent data buffer
            this.recentData.push(data);
            if (this.recentData.length > this.maxRecentData) {
                this.recentData.shift();
            }

            // Initialize session if needed
            if (!this.sessionData.startTime) {
                this.sessionData.startTime = Date.now();
            }

            // Track peak values
            if (data.rpm !== null && data.rpm > this.sessionData.peakRPM) {
                this.sessionData.peakRPM = data.rpm;
                System.log('Engine', `New peak RPM: ${Math.round(data.rpm)}`);
            }

            if (data.speed !== null && data.speed > this.sessionData.peakSpeed) {
                this.sessionData.peakSpeed = data.speed;
                System.log('Engine', `New peak speed: ${Math.round(data.speed)} km/h`);
            }

            if (data.load !== null && data.load > this.sessionData.peakLoad) {
                this.sessionData.peakLoad = data.load;
            }

            if (data.maf !== null && data.maf > this.sessionData.peakMAF) {
                this.sessionData.peakMAF = data.maf;
            }

            if (data.timing !== null && data.timing < this.sessionData.minTiming) {
                this.sessionData.minTiming = data.timing;
                if (data.timing < -5) {
                    System.log('Engine', `⚠️ Timing retard detected: ${data.timing.toFixed(1)}°`);
                }
            }

            // Detect acceleration runs (0-60 timing)
            this.detectAcceleration(data);

            // Analyze engine efficiency
            this.analyzeEfficiency(data);
        },

        /**
         * Detect and time acceleration runs
         */
        detectAcceleration(data) {
            if (data.speed === null) return;

            const speed = data.speed;

            // Start acceleration timer when speed crosses 5 km/h
            if (speed > 5 && speed < 15 && !this.sessionData.accelStartTime) {
                this.sessionData.accelStartTime = Date.now();
                this.sessionData.accelStartSpeed = speed;
                System.log('Engine', '🏁 Acceleration run started');
            }

            // Measure 0-60 km/h (approximately 0-37 mph)
            if (this.sessionData.accelStartTime && !this.sessionData.time0to60 && speed >= 60) {
                const elapsed = (Date.now() - this.sessionData.accelStartTime) / 1000;
                this.sessionData.time0to60 = elapsed;
                System.log('Engine', `✓ 0-60 km/h: ${elapsed.toFixed(2)} seconds`);
            }

            // Measure quarter mile (400m) - approximate via speed integration
            // This is simplified; real implementation needs distance calculation
        },

        /**
         * Analyze engine efficiency and health
         */
        analyzeEfficiency(data) {
            if (this.recentData.length < 10) return;

            // Calculate average fuel efficiency (simplified)
            // Real calculation would need fuel flow rate PID
            if (data.maf !== null && data.speed !== null && data.speed > 0) {
                // Approximate: Higher MAF with lower speed = less efficient
                const efficiency = data.speed / (data.maf + 1);
                // This is a rough metric; professional systems use fuel flow sensors
            }

            // Detect heavy load conditions
            if (data.load !== null && data.load > 90) {
                const recentAvgLoad = this.recentData
                    .slice(-5)
                    .filter(d => d.load !== null)
                    .reduce((sum, d) => sum + d.load, 0) / 5;
                
                if (recentAvgLoad > 85) {
                    // Sustained heavy load
                    const duration = (Date.now() - this.sessionData.startTime) / 1000;
                    if (duration % 30 < 0.5) { // Log every 30 seconds
                        System.log('Engine', `Heavy load sustained: ${recentAvgLoad.toFixed(1)}% avg`);
                    }
                }
            }

            // Detect knock/timing issues
            if (data.timing !== null && data.load !== null) {
                if (data.timing < 5 && data.load > 50) {
                    System.log('Engine', '⚠️ Low timing under load - possible knock protection active');
                }
            }
        },

        /**
         * Render UI (only if engine view is active)
         */
        render(data) {
            // Real-time gauges
            this.updateGauge('engine-load-gauge', data.load, 100, 'Load', '%');
            this.updateGauge('engine-maf-gauge', data.maf, 20, 'MAF', 'g/s');
            this.updateNumeric('engine-iat-val', data.iat, '°C');
            this.updateNumeric('engine-timing-val', data.timing, '°', 1);

            // Peak trackers
            this.updateNumeric('peak-rpm-val', this.sessionData.peakRPM, ' RPM', 0);
            this.updateNumeric('peak-speed-val', this.sessionData.peakSpeed, ' km/h', 0);
            this.updateNumeric('peak-load-val', this.sessionData.peakLoad, '%', 1);

            // Acceleration times
            if (this.sessionData.time0to60) {
                const el = document.getElementById('accel-0-60');
                if (el) el.textContent = this.sessionData.time0to60.toFixed(2) + 's';
            }

            // Calculate estimated horsepower (very rough approximation)
            if (data.load !== null && data.rpm !== null) {
                const estimatedHP = this.estimateHorsepower(data);
                this.updateNumeric('estimated-hp', estimatedHP, ' HP', 0);
            }
        },

        /**
         * Update gauge UI element
         */
        updateGauge(id, value, max, label, unit) {
            const container = document.getElementById(id);
            if (!container || value === null) return;

            const percentage = Math.min(Math.max(value / max, 0), 1);
            const bar = container.querySelector('.gauge-bar');
            const valueEl = container.querySelector('.gauge-value');
            
            if (bar) bar.style.width = (percentage * 100) + '%';
            if (valueEl) valueEl.textContent = value.toFixed(1) + unit;
        },

        /**
         * Update numeric display
         */
        updateNumeric(id, value, unit, decimals = 0) {
            const el = document.getElementById(id);
            if (!el || value === null) return;
            el.textContent = value.toFixed(decimals) + unit;
        },

        /**
         * Estimate horsepower (simplified calculation)
         * Real calculation requires torque curve data
         */
        estimateHorsepower(data) {
            if (!data.rpm || !data.load) return 0;

            // Very rough estimation: HP = (Torque × RPM) / 5252
            // We don't have torque, so estimate from load and typical engine displacement
            // This is NOT accurate - just for demonstration
            const estimatedTorque = (data.load / 100) * 200; // Assume 200 lb-ft max
            const hp = (estimatedTorque * data.rpm) / 5252;
            
            return Math.max(0, hp);
        },

        /**
         * Generate simulated data for demo mode
         */
        generateSimData() {
            const time = Date.now() / 1000;
            
            // Simulate varying performance conditions
            const baseRPM = 2000 + Math.sin(time * 0.3) * 1500;
            const baseSpeed = 30 + Math.sin(time * 0.2) * 20;
            
            return {
                rpm: baseRPM + Math.random() * 100,
                speed: Math.max(0, baseSpeed + Math.random() * 5),
                load: 30 + Math.sin(time * 0.5) * 20 + Math.random() * 10,
                timing: 10 + Math.sin(time * 0.4) * 5 + Math.random() * 2,
                iat: 25 + Math.random() * 10,
                maf: 5 + Math.sin(time * 0.3) * 3 + Math.random() * 1,
                map: null, // Not commonly available
                baro: 101.3, // Sea level
                timestamp: Date.now()
            };
        },

        /**
         * Reset session data
         */
        resetSession() {
            this.sessionData = {
                startTime: Date.now(),
                peakRPM: 0,
                peakSpeed: 0,
                peakLoad: 0,
                peakMAF: 0,
                minTiming: 999,
                maxBoost: 0,
                accelStartTime: null,
                accelStartSpeed: 0,
                time0to60: null,
                quarterMileTime: null,
                quarterMileSpeed: null
            };
            this.recentData = [];
            System.log('Engine', 'Session reset - tracking new performance data');
        },

        /**
         * Export session data
         */
        exportSession() {
            const sessionSummary = {
                duration: (Date.now() - this.sessionData.startTime) / 1000,
                peakRPM: this.sessionData.peakRPM,
                peakSpeed: this.sessionData.peakSpeed,
                peakLoad: this.sessionData.peakLoad,
                time0to60: this.sessionData.time0to60,
                dataPoints: this.recentData.length
            };

            const blob = new Blob([JSON.stringify(sessionSummary, null, 2)], 
                                 { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `engine-session-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);

            System.log('Engine', 'Session data exported');
        },

        /**
         * Activate module
         */
        activate() {
            this.isActive = true;
            System.log('Engine', 'Module activated');
        },

        /**
         * Deactivate module
         */
        deactivate() {
            this.isActive = false;
            System.log('Engine', 'Module deactivated');
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
            this.recentData = [];
            System.log('Engine', 'Shutdown complete');
        }
    };

    // Register and initialize
    window.System.activeApps.engine = EngineApp;
    EngineApp.init();
    
    // Global helper for session reset
    window.resetEngineSession = () => EngineApp.resetSession();
    window.exportEngineSession = () => EngineApp.exportSession();
})();

