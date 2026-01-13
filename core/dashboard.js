/**
 * Gnokestation Dashboard App v2.4
 * Feature: Fully animated demo mode with realistic telemetry simulation
 * Fix: All gauges now animate smoothly in demo mode
 */
(() => {
    const DashboardApp = {
        id: 'dashboard',
        category: 'performance',
        updateInterval: null,
        isBusy: false,
        
        // Simulation state for realistic animations
        simState: {
            time: 0,
            rpmBase: 800,
            speedBase: 0,
            coolantTemp: 70, // Starts cold
            fuelLevel: 75,
            batteryVoltage: 14.1,
            throttlePos: 0
        },

        init() {
            System.log('Dashboard', 'Initializing Modular Dashboard...');
            
            // 100ms refresh for smooth animations (10Hz)
            this.updateInterval = setInterval(() => this.tick(), 100);
            this.setupCategoryListeners();
            
            // Auto-activate plugins for demo mode
            this.activatePlugins();
            
            System.log('Dashboard', '✓ Host Ready (10Hz refresh)');
        },

        activatePlugins() {
            const plugins = ['timing', 'emissions', 'battery'];
            plugins.forEach(plugin => {
                if (System.activeApps[plugin]?.activate) {
                    System.activeApps[plugin].activate();
                }
            });
        },

        setCategory(cat) {
            this.category = cat;
            System.log('Dashboard', `Switching view to: ${cat}`);
            
            document.querySelectorAll('.dash-icon').forEach(icon => {
                icon.classList.toggle('active', icon.dataset.cat === cat);
            });
        },

        async tick() {
            const isDashVisible = document.getElementById('dash')?.classList.contains('active');
            const isConnected = window.obd?.connected || window.isSimulating;
            
            if (isDashVisible && isConnected && !this.isBusy) {
                await this.update();
            }
        },

        async update() {
            this.isBusy = true;
            try {
                const data = window.isSimulating 
                    ? this.generateSimData() 
                    : await this.fetchHardwareData();
                
                if (data) this.render(data);
            } catch (err) {
                System.log('Dashboard', `Stream Error: ${err.message}`);
            } finally {
                this.isBusy = false;
            }
        },

        async fetchHardwareData() {
            if (!window.obd?.connected) return null;

            const rpmRaw = await window.obd.sendCommand(PIDS.RPM.code);
            const speedRaw = await window.obd.sendCommand(PIDS.SPEED.code);
            const coolantRaw = await window.obd.sendCommand(PIDS.COOLANT.code);

            const telemetry = {
                rpm: PIDS.RPM.parse(window.parseOBDResponse(rpmRaw, '410C')),
                speed: PIDS.SPEED.parse(window.parseOBDResponse(speedRaw, '410D')),
                coolant: PIDS.COOLANT.parse(window.parseOBDResponse(coolantRaw, '4105')),
                categoryData: null
            };

            try {
                const fuelRaw = await window.obd.sendCommand(PIDS.FUEL_LEVEL.code);
                telemetry.fuel = PIDS.FUEL_LEVEL.parse(window.parseOBDResponse(fuelRaw, '412F'));
            } catch (err) {
                telemetry.fuel = null;
            }

            try {
                const throttleRaw = await window.obd.sendCommand(PIDS.THROTTLE.code);
                telemetry.throttle = PIDS.THROTTLE.parse(window.parseOBDResponse(throttleRaw, '4111'));
            } catch (err) {
                telemetry.throttle = null;
            }

            try {
                const batteryRaw = await window.obd.sendCommand(PIDS.BATTERY.code);
                telemetry.battery = PIDS.BATTERY.parse(window.parseOBDResponse(batteryRaw, '4142'));
            } catch (err) {
                telemetry.battery = null;
            }

            if (this.category === 'fuel' && window.System.activeApps.fuel) {
                telemetry.categoryData = await window.System.activeApps.fuel.quickPoll();
            } else if (this.category === 'battery' && window.System.activeApps.battery) {
                telemetry.categoryData = await window.System.activeApps.battery.quickPoll();
            }

            return telemetry;
        },

        render(data) {
            // 1. Main RPM Gauge
            const mainVal = document.getElementById('main-val');
            const speedVal = document.getElementById('v-speed');
            
            if (mainVal) mainVal.textContent = Math.round(data.rpm || 0);
            if (speedVal) speedVal.textContent = Math.round(data.speed || 0);

            // Update RPM gauge ring
            const gaugeProgress = document.getElementById('gauge-progress');
            if (gaugeProgress && data.rpm !== null) {
                const maxRpm = 7000;
                const percentage = Math.min(data.rpm / maxRpm, 1);
                const circumference = 264;
                const dasharray = `${198 * percentage} ${circumference}`;
                gaugeProgress.setAttribute('stroke-dasharray', dasharray);
            }

            // 2. Coolant Temperature
            const tempVal = document.getElementById('v-temp');
            if (tempVal) {
                if (data.coolant !== null && data.coolant !== undefined) {
                    tempVal.textContent = Math.round(data.coolant);
                    if (data.coolant > 100) {
                        tempVal.style.color = 'var(--red)';
                    } else if (data.coolant > 95) {
                        tempVal.style.color = 'var(--orange)';
                    } else {
                        tempVal.style.color = 'var(--accent)';
                    }
                } else {
                    tempVal.textContent = '--';
                }
            }

            // 3. Fuel Level Gauge
            this.updateCircularGauge('fuel-ring', 'fuel-val', data.fuel, 100, 'var(--green)');

            // 4. Battery Voltage Gauge
            if (data.battery !== null) {
                const battVal = document.getElementById('batt-val');
                if (battVal) battVal.textContent = data.battery.toFixed(1);
                
                // Map 11-15V to 0-100%
                const battPercent = ((data.battery - 11) / 4) * 100;
                this.updateCircularGauge('batt-ring', null, battPercent, 100, 'var(--blue)');
            }

            // 5. Throttle Position Gauge
            this.updateCircularGauge('throttle-ring', 'throttle-val', data.throttle, 100, 'var(--orange)');

            // 6. Category-Specific UI
            this.renderCategoryOverlay(data);
        },

        updateCircularGauge(ringId, valueId, value, max, color) {
            const ring = document.getElementById(ringId);
            const valueEl = document.getElementById(valueId);
            
            if (ring && value !== null && value !== undefined) {
                const percentage = Math.min(Math.max(value / max, 0), 1);
                const circumference = 157;
                const dasharray = `${circumference * percentage} ${circumference}`;
                ring.setAttribute('stroke-dasharray', dasharray);
                if (color) ring.setAttribute('stroke', color);
            }
            
            if (valueEl && value !== null && value !== undefined) {
                valueEl.textContent = Math.round(value);
            } else if (valueEl) {
                valueEl.textContent = '--';
            }
        },

        renderCategoryOverlay(data) {
            const container = document.getElementById('category-overlay');
            if (!container) return;
        },

        setupCategoryListeners() {
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-cat]');
                if (btn) this.setCategory(btn.dataset.cat);
            });
        },

        /**
         * Generate REALISTIC ANIMATED simulated data
         * Simulates a vehicle idling with natural variations
         */
        generateSimData() {
            // Increment time for animations
            this.simState.time += 0.1;
            
            // 1. RPM - Simulate idle with natural oscillation
            // Real engines oscillate between 750-900 RPM at idle
            const rpmWave = Math.sin(this.simState.time * 0.5) * 50; // Slow wave
            const rpmNoise = (Math.random() - 0.5) * 30; // Random flutter
            const rpm = 800 + rpmWave + rpmNoise;
            
            // 2. Speed - Simulate slight GPS drift even when stationary
            const speed = Math.random() * 2; // 0-2 km/h (GPS noise)
            
            // 3. Coolant - Gradually warm up from cold start to operating temp
            const targetTemp = 88; // Normal operating temperature
            if (this.simState.coolantTemp < targetTemp) {
                this.simState.coolantTemp += 0.02; // Slow warmup
            }
            const coolant = this.simState.coolantTemp + (Math.random() - 0.5) * 2;
            
            // 4. Fuel - Very slowly decreasing (1% per ~30 seconds)
            this.simState.fuelLevel -= 0.0003;
            if (this.simState.fuelLevel < 10) this.simState.fuelLevel = 75; // Reset
            const fuel = this.simState.fuelLevel + (Math.random() - 0.5) * 0.5;
            
            // 5. Battery - Simulate alternator voltage with ripple
            // Running engine: 13.8-14.4V typical
            const batteryRipple = Math.sin(this.simState.time * 3) * 0.15; // AC ripple
            const batteryNoise = (Math.random() - 0.5) * 0.1;
            const battery = 14.1 + batteryRipple + batteryNoise;
            
            // 6. Throttle - Correlates with RPM variations
            // At idle, throttle should be near 0% but flutters with idle control
            const throttle = Math.max(0, ((rpm - 750) / 1500) * 10 + Math.random() * 2);
            
            return {
                rpm: Math.max(700, rpm), // Don't go below stall speed
                speed: Math.max(0, speed),
                coolant: Math.max(60, Math.min(110, coolant)), // Clamp to realistic range
                fuel: Math.max(0, Math.min(100, fuel)),
                battery: Math.max(13.5, Math.min(14.8, battery)),
                throttle: Math.max(0, Math.min(100, throttle)),
                categoryData: {}
            };
        },

        shutdown() {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
        }
    };

    window.System.activeApps.dashboard = DashboardApp;
    DashboardApp.init();
})();