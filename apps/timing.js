/**
 * Gnokestation Timing & Load Monitor v3.0
 * Production-ready module for ignition timing and engine load telemetry
 * 
 * Features:
 * - Intelligent polling with bandwidth awareness
 * - Knock detection and logging
 * - Graceful degradation if PIDs unsupported
 * - UI integration with fallback handling
 */

(() => {
    const TimingApp = {
        id: 'timing',
        updateInterval: null,
        pollingRate: 500, // 2Hz - balanced for performance monitoring
        isActive: false,
        supported: { timing: true, load: true }, // Feature detection
        consecutiveErrors: 0,
        maxErrors: 3, // Disable after 3 consecutive failures

        /**
         * Initialize module and register with system
         */
        init() {
            System.log('Timing', 'Initializing Timing & Load Monitor...');
            
            // Only start polling when connected
            this.updateInterval = setInterval(() => this.tick(), this.pollingRate);
            
            System.log('Timing', `✓ Ready (${this.pollingRate}ms polling)`);
        },

        /**
         * Intelligent tick - only polls when dashboard is visible and connected
         */
        async tick() {
            const isDashVisible = document.getElementById('dash')?.classList.contains('active');
            const isConnected = window.obd?.connected || window.isSimulating;
            
            if (!isDashVisible || !isConnected || !this.isActive) return;
            
            // Back off if too many errors
            if (this.consecutiveErrors >= this.maxErrors) {
                if (this.consecutiveErrors === this.maxErrors) {
                    System.log('Timing', 'Module disabled after repeated failures');
                    this.consecutiveErrors++; // Only log once
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
                    this.consecutiveErrors = 0; // Reset error counter on success
                }
            } catch (err) {
                this.consecutiveErrors++;
                System.log('Timing', `Poll error (${this.consecutiveErrors}/${this.maxErrors}): ${err.message}`);
            }
        },

        /**
         * Fetch timing and load data from hardware
         */
        async fetchData() {
            const data = { timing: null, load: null };

            // Only poll supported PIDs
            if (this.supported.timing) {
                try {
                    const timingRaw = await window.obd.sendCommand(PIDS.TIMING_ADVANCE.code);
                    const bytes = window.parseOBDResponse(timingRaw, '410E');
                    data.timing = PIDS.TIMING_ADVANCE.parse(bytes);
                } catch (err) {
                    this.supported.timing = false;
                    System.log('Timing', 'PID 010E not supported - timing disabled');
                }
            }

            if (this.supported.load) {
                try {
                    const loadRaw = await window.obd.sendCommand(PIDS.ENGINE_LOAD.code);
                    const bytes = window.parseOBDResponse(loadRaw, '4104');
                    data.load = PIDS.ENGINE_LOAD.parse(bytes);
                } catch (err) {
                    this.supported.load = false;
                    System.log('Timing', 'PID 0104 not supported - load disabled');
                }
            }

            return data;
        },

        /**
         * Update UI and perform intelligent monitoring
         */
        render(data) {
            // Update timing display
            const timingEl = document.getElementById('v-timing');
            if (timingEl && data.timing !== null) {
                timingEl.textContent = data.timing.toFixed(1) + '°';
                
                // Visual warning for timing anomalies
                if (data.timing < -5) {
                    timingEl.style.color = 'var(--red)';
                } else if (data.timing < 0) {
                    timingEl.style.color = 'var(--orange)';
                } else {
                    timingEl.style.color = 'var(--accent)';
                }
            }

            // Update load display
            const loadEl = document.getElementById('v-load');
            if (loadEl && data.load !== null) {
                loadEl.textContent = Math.round(data.load) + '%';
                
                // Color code by load level
                if (data.load > 85) {
                    loadEl.style.color = 'var(--red)';
                } else if (data.load > 70) {
                    loadEl.style.color = 'var(--orange)';
                } else {
                    loadEl.style.color = 'var(--accent)';
                }
            }

            // Update circular gauge if present
            this.updateGauge('load-ring', data.load, 100);

            // Intelligent monitoring: Log potential knock events
            if (data.timing !== null && data.timing < -5) {
                System.log('Timing', `⚠️ Significant timing retard: ${data.timing.toFixed(1)}° (possible knock)`);
            }

            // Monitor for heavy load conditions
            if (data.load !== null && data.load > 90) {
                System.log('Timing', `Heavy engine load: ${data.load.toFixed(1)}%`);
            }
        },

        /**
         * Update circular gauge UI element
         */
        updateGauge(elementId, value, max) {
            const ring = document.getElementById(elementId);
            if (!ring || value === null) return;

            const percentage = Math.min(Math.max(value / max, 0), 1);
            const circumference = 157; // 2πr where r=25
            const dasharray = `${circumference * percentage} ${circumference}`;
            ring.setAttribute('stroke-dasharray', dasharray);
        },

        /**
         * Generate simulated data for demo mode
         */
        generateSimData() {
            return {
                timing: 8 + (Math.random() * 4 - 2), // 6-10° typical
                load: 15 + Math.random() * 10 // 15-25% idle load
            };
        },

        /**
         * Activate module (called when dashboard needs timing data)
         */
        activate() {
            this.isActive = true;
            System.log('Timing', 'Module activated');
        },

        /**
         * Deactivate module (called to save bandwidth)
         */
        deactivate() {
            this.isActive = false;
            System.log('Timing', 'Module deactivated');
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
            System.log('Timing', 'Shutdown complete');
        }
    };

    // Register and initialize
    window.System.activeApps.timing = TimingApp;
    TimingApp.init();
})();