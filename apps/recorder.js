/**
 * Gnokestation Data Recorder & Visualization v1.0
 * 
 * Features AndrOBD has that you're missing:
 * - Real-time graphing of PIDs
 * - Session recording to CSV
 * - Data playback
 * - Multi-parameter charts
 * - Session comparison
 * 
 * THIS IS CRITICAL - Most users want to see trends over time, not just current values
 */

(() => {
    const RecorderApp = {
        id: 'recorder',
        
        // Recording state
        isRecording: false,
        recordingStartTime: null,
        recordedData: [], // Array of data snapshots
        maxRecordingSize: 10000, // Limit to prevent memory issues
        
        // Playback state
        isPlaying: false,
        playbackIndex: 0,
        playbackInterval: null,
        
        // Chart state
        charts: {},
        chartUpdateInterval: null,
        maxChartPoints: 60, // Show last 60 seconds at 1Hz
        
        // Selected PIDs for recording
        recordingPIDs: ['RPM', 'SPEED', 'COOLANT', 'THROTTLE', 'BATTERY'],

        /**
         * Initialize recorder
         */
        init() {
            System.log('Recorder', 'Initializing Data Recorder...');
            
            // Setup chart update loop (1Hz for performance)
            this.chartUpdateInterval = setInterval(() => this.updateCharts(), 1000);
            
            System.log('Recorder', '✓ Recorder ready');
        },

        /**
         * Start recording session
         */
        startRecording() {
            if (this.isRecording) return;
            
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            this.recordedData = [];
            
            System.log('Recorder', '🔴 Recording started');
            
            // Update UI
            const btn = document.getElementById('record-btn');
            if (btn) {
                btn.textContent = '⏹️ Stop Recording';
                btn.style.background = 'var(--red)';
            }
            
            // Start capture loop
            this.captureLoop();
        },

        /**
         * Stop recording session
         */
        stopRecording() {
            if (!this.isRecording) return;
            
            this.isRecording = false;
            const duration = (Date.now() - this.recordingStartTime) / 1000;
            
            System.log('Recorder', `⏹️ Recording stopped - ${this.recordedData.length} samples over ${duration.toFixed(1)}s`);
            
            // Update UI
            const btn = document.getElementById('record-btn');
            if (btn) {
                btn.textContent = '🔴 Start Recording';
                btn.style.background = 'var(--accent)';
            }
            
            // Enable export button
            const exportBtn = document.getElementById('export-session-btn');
            if (exportBtn) exportBtn.disabled = false;
        },

        /**
         * Capture data snapshots while recording
         */
        async captureLoop() {
            if (!this.isRecording) return;
            
            // Capture current state from all active apps
            const snapshot = {
                timestamp: Date.now(),
                elapsed: (Date.now() - this.recordingStartTime) / 1000,
                data: {}
            };
            
            // Collect data from dashboard
            if (System.activeApps.dashboard) {
                const dashData = System.activeApps.dashboard.simState || {};
                Object.assign(snapshot.data, dashData);
            }
            
            // Collect from other plugins
            for (const pid of this.recordingPIDs) {
                const value = this.getCurrentPIDValue(pid);
                if (value !== null) snapshot.data[pid] = value;
            }
            
            this.recordedData.push(snapshot);
            
            // Prevent memory overflow
            if (this.recordedData.length > this.maxRecordingSize) {
                System.log('Recorder', '⚠️ Max recording size reached - stopping');
                this.stopRecording();
                return;
            }
            
            // Continue capturing at 10Hz
            setTimeout(() => this.captureLoop(), 100);
        },

        /**
         * Get current value for a PID
         */
        getCurrentPIDValue(pidName) {
            // Try to read from UI elements
            const elementMap = {
                'RPM': 'main-val',
                'SPEED': 'v-speed',
                'COOLANT': 'v-temp',
                'THROTTLE': 'throttle-val',
                'BATTERY': 'batt-val',
                'FUEL': 'fuel-val'
            };
            
            const el = document.getElementById(elementMap[pidName]);
            if (el && el.textContent !== '--') {
                return parseFloat(el.textContent);
            }
            return null;
        },

        /**
         * Update real-time charts
         */
        updateCharts() {
            const chartContainer = document.getElementById('chart-container');
            if (!chartContainer || !chartContainer.classList.contains('active')) return;
            
            // If recording, add current values to charts
            if (this.isRecording && this.recordedData.length > 0) {
                this.renderCharts();
            }
        },

        /**
         * Render charts using simple canvas drawing
         */
        renderCharts() {
            const chartCanvas = document.getElementById('data-chart');
            if (!chartCanvas) return;
            
            const ctx = chartCanvas.getContext('2d');
            const width = chartCanvas.width;
            const height = chartCanvas.height;
            
            // Clear canvas
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            
            // Get last N data points
            const dataPoints = this.recordedData.slice(-this.maxChartPoints);
            if (dataPoints.length < 2) return;
            
            // Draw grid
            this.drawGrid(ctx, width, height);
            
            // Draw multiple traces
            this.drawTrace(ctx, dataPoints, 'RPM', '#1b3a4b', width, height, 0, 7000);
            this.drawTrace(ctx, dataPoints, 'SPEED', '#e67e22', width, height, 0, 200);
            
            // Draw legend
            this.drawLegend(ctx, width);
        },

        /**
         * Draw grid lines
         */
        drawGrid(ctx, width, height) {
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 1;
            
            // Horizontal lines
            for (let i = 0; i <= 5; i++) {
                const y = (height / 5) * i;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
            
            // Vertical lines
            for (let i = 0; i <= 10; i++) {
                const x = (width / 10) * i;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
        },

        /**
         * Draw a data trace
         */
        drawTrace(ctx, dataPoints, pidName, color, width, height, min, max) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            let firstPoint = true;
            dataPoints.forEach((point, i) => {
                const value = point.data[pidName];
                if (value === null || value === undefined) return;
                
                const x = (i / dataPoints.length) * width;
                const normalizedValue = (value - min) / (max - min);
                const y = height - (normalizedValue * height);
                
                if (firstPoint) {
                    ctx.moveTo(x, y);
                    firstPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
        },

        /**
         * Draw legend
         */
        drawLegend(ctx, width) {
            ctx.fillStyle = '#1b3a4b';
            ctx.font = '12px sans-serif';
            ctx.fillText('RPM (0-7000)', 10, 20);
            
            ctx.fillStyle = '#e67e22';
            ctx.fillText('Speed (0-200 km/h)', 10, 40);
        },

        /**
         * Export session to CSV
         */
        exportToCSV() {
            if (this.recordedData.length === 0) {
                alert('No data to export');
                return;
            }
            
            // Build CSV header
            const allKeys = new Set();
            this.recordedData.forEach(snapshot => {
                Object.keys(snapshot.data).forEach(key => allKeys.add(key));
            });
            
            const headers = ['Timestamp', 'Elapsed (s)', ...Array.from(allKeys)];
            let csv = headers.join(',') + '\n';
            
            // Build CSV rows
            this.recordedData.forEach(snapshot => {
                const row = [
                    new Date(snapshot.timestamp).toISOString(),
                    snapshot.elapsed.toFixed(3),
                    ...Array.from(allKeys).map(key => snapshot.data[key] ?? '')
                ];
                csv += row.join(',') + '\n';
            });
            
            // Download
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gnokestation-session-${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            
            System.log('Recorder', `Exported ${this.recordedData.length} samples to CSV`);
        },

        /**
         * Load session from CSV (for playback)
         */
        async loadFromCSV(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const csv = e.target.result;
                    const lines = csv.split('\n');
                    const headers = lines[0].split(',');
                    
                    const data = [];
                    for (let i = 1; i < lines.length; i++) {
                        if (!lines[i].trim()) continue;
                        
                        const values = lines[i].split(',');
                        const snapshot = {
                            timestamp: new Date(values[0]).getTime(),
                            elapsed: parseFloat(values[1]),
                            data: {}
                        };
                        
                        for (let j = 2; j < headers.length; j++) {
                            const key = headers[j].trim();
                            const value = parseFloat(values[j]);
                            if (!isNaN(value)) snapshot.data[key] = value;
                        }
                        
                        data.push(snapshot);
                    }
                    
                    this.recordedData = data;
                    System.log('Recorder', `Loaded ${data.length} samples from CSV`);
                    resolve(data);
                };
                reader.onerror = reject;
                reader.readAsText(file);
            });
        },

        /**
         * Start playback of recorded session
         */
        startPlayback() {
            if (this.recordedData.length === 0) {
                alert('No recorded data to play');
                return;
            }
            
            this.isPlaying = true;
            this.playbackIndex = 0;
            
            System.log('Recorder', '▶️ Playback started');
            
            this.playbackInterval = setInterval(() => {
                if (this.playbackIndex >= this.recordedData.length) {
                    this.stopPlayback();
                    return;
                }
                
                const snapshot = this.recordedData[this.playbackIndex];
                this.applySnapshot(snapshot);
                this.playbackIndex++;
            }, 100); // Play at 10x speed
        },

        /**
         * Stop playback
         */
        stopPlayback() {
            this.isPlaying = false;
            if (this.playbackInterval) {
                clearInterval(this.playbackInterval);
                this.playbackInterval = null;
            }
            System.log('Recorder', '⏹️ Playback stopped');
        },

        /**
         * Apply a snapshot to the UI (during playback)
         */
        applySnapshot(snapshot) {
            // Update UI elements with snapshot data
            Object.keys(snapshot.data).forEach(key => {
                const elementMap = {
                    'RPM': 'main-val',
                    'SPEED': 'v-speed',
                    'COOLANT': 'v-temp',
                    'THROTTLE': 'throttle-val',
                    'BATTERY': 'batt-val',
                    'FUEL': 'fuel-val'
                };
                
                const el = document.getElementById(elementMap[key]);
                if (el) {
                    el.textContent = Math.round(snapshot.data[key]);
                }
            });
        },

        /**
         * Shutdown
         */
        shutdown() {
            this.stopRecording();
            this.stopPlayback();
            if (this.chartUpdateInterval) {
                clearInterval(this.chartUpdateInterval);
                this.chartUpdateInterval = null;
            }
        }
    };

    // Register
    window.System.activeApps.recorder = RecorderApp;
    RecorderApp.init();
    
    // Global helpers
    window.toggleRecording = () => {
        if (RecorderApp.isRecording) {
            RecorderApp.stopRecording();
        } else {
            RecorderApp.startRecording();
        }
    };
    
    window.exportSession = () => RecorderApp.exportToCSV();
    window.togglePlayback = () => {
        if (RecorderApp.isPlaying) {
            RecorderApp.stopPlayback();
        } else {
            RecorderApp.startPlayback();
        }
    };
})();

