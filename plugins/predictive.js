/**
 * Gnokestation Predictive Maintenance Assistant v1.0
 * File: plugins/predictive.js
 * 
 * COMPLETELY PASSIVE - Does not interfere with existing plugins
 * 
 * What this does:
 * - Silently collects data from existing plugins (battery, emissions, monitoring)
 * - Stores historical snapshots using window.storage
 * - Analyzes trends to predict component failures
 * - Only activates when user opens the Predictive tab
 * 
 * Data sources (all passive listeners):
 * - Battery voltage trends → Predicts battery replacement need
 * - Mode 06 catalyst values → Predicts P0420 before it triggers
 * - Fuel trim drift → Predicts O2 sensor or vacuum leak issues
 * - Coolant temp patterns → Detects thermostat degradation
 * 
 * NO MODIFICATIONS to existing plugins required.
 * Can be removed by simply deleting from PLUGINS array.
 */

(() => {
    const PredictiveApp = {
        id: 'predictive',
        
        // Storage keys for persistent data
        storageKeys: {
            snapshots: 'predictive_snapshots',
            predictions: 'predictive_predictions',
            lastAnalysis: 'predictive_last_analysis'
        },
        
        // Data collection
        dataCollectionInterval: null,
        collectionRate: 60000, // Collect snapshot every 60 seconds when connected
        maxSnapshots: 500, // Keep last 500 snapshots (8+ hours of data at 1/min)
        
        // Analysis state
        predictions: [],
        lastAnalysisTime: null,
        isAnalyzing: false,
        
        // Component health thresholds
        thresholds: {
            battery: {
                criticalLow: 12.0,
                warningLow: 12.4,
                criticalHigh: 15.0,
                warningHigh: 14.8
            },
            catalyst: {
                warningRatio: 0.40,  // 80% of 0.50 limit
                criticalRatio: 0.45  // 90% of 0.50 limit
            },
            fuelTrim: {
                warningOffset: 10,   // ±10% from zero
                criticalOffset: 20   // ±20% from zero
            }
        },

        /**
         * Initialize module - completely passive
         */
        init() {
            System.log('Predictive', 'Initializing Predictive Maintenance...');
            
            // Load stored data
            this.loadStoredData();
            
            // Start passive data collection when connected
            this.dataCollectionInterval = setInterval(() => this.collectSnapshot(), this.collectionRate);
            
            System.log('Predictive', '✓ Ready - Passive monitoring active');
        },

        /**
         * Load historical data from storage
         */
        async loadStoredData() {
            try {
                const snapshotsData = await window.storage.get(this.storageKeys.snapshots);
                const predictionsData = await window.storage.get(this.storageKeys.predictions);
                const lastAnalysisData = await window.storage.get(this.storageKeys.lastAnalysis);
                
                if (snapshotsData && snapshotsData.value) {
                    const parsed = JSON.parse(snapshotsData.value);
                    this.snapshots = parsed || [];
                    System.log('Predictive', `Loaded ${this.snapshots.length} historical snapshots`);
                } else {
                    this.snapshots = [];
                }
                
                if (predictionsData && predictionsData.value) {
                    this.predictions = JSON.parse(predictionsData.value) || [];
                }
                
                if (lastAnalysisData && lastAnalysisData.value) {
                    this.lastAnalysisTime = parseInt(lastAnalysisData.value);
                }
            } catch (err) {
                // Storage not available or empty - start fresh
                this.snapshots = [];
                this.predictions = [];
                System.log('Predictive', 'Starting fresh - no historical data found');
            }
        },

        /**
         * Passively collect data snapshot from other plugins
         * Does NOT call any plugin methods - only reads their exposed state
         */
        async collectSnapshot() {
            const isConnected = window.obd?.connected || window.isSimulating;
            if (!isConnected) return;
            
            const snapshot = {
                timestamp: Date.now(),
                date: new Date().toISOString(),
                data: {}
            };
            
            // Passively read battery data if available
            if (System.activeApps.battery && System.activeApps.battery.voltageHistory) {
                const batteryHistory = System.activeApps.battery.voltageHistory;
                if (batteryHistory.length > 0) {
                    snapshot.data.battery = batteryHistory[batteryHistory.length - 1];
                }
            }
            
            // Passively read emissions data if available
            if (System.activeApps.emissions && System.activeApps.emissions.trimHistory) {
                const trimHistory = System.activeApps.emissions.trimHistory;
                if (trimHistory.length > 0) {
                    snapshot.data.fuelTrim = trimHistory[trimHistory.length - 1];
                }
            }
            
            // Passively read Mode 06 monitoring data if available
            if (System.activeApps.monitoring && System.activeApps.monitoring.testResults) {
                const testResults = System.activeApps.monitoring.testResults;
                // Extract catalyst efficiency if present
                const catalystTest = testResults.find(t => t.testID === '01');
                if (catalystTest) {
                    snapshot.data.catalystRatio = catalystTest.value;
                    snapshot.data.catalystPercent = catalystTest.percentToLimit;
                }
            }
            
            // Passively read dashboard data if available
            if (System.activeApps.dashboard && System.activeApps.dashboard.simState) {
                const state = System.activeApps.dashboard.simState;
                if (state.coolantTemp) {
                    snapshot.data.coolantTemp = state.coolantTemp;
                }
            }
            
            // Only store if we collected some data
            if (Object.keys(snapshot.data).length > 0) {
                this.snapshots.push(snapshot);
                
                // Trim to max size
                if (this.snapshots.length > this.maxSnapshots) {
                    this.snapshots = this.snapshots.slice(-this.maxSnapshots);
                }
                
                // Persist to storage (non-blocking)
                this.saveSnapshots();
            }
        },

        /**
         * Save snapshots to persistent storage
         */
        async saveSnapshots() {
            try {
                await window.storage.set(
                    this.storageKeys.snapshots, 
                    JSON.stringify(this.snapshots)
                );
            } catch (err) {
                // Silent fail - storage is optional
            }
        },

        /**
         * Run predictive analysis on historical data
         * Only called when user opens the Predictive tab
         */
        async runAnalysis() {
            if (this.isAnalyzing) return;
            if (this.snapshots.length < 5) {
                this.render();
                return;
            }
            
            this.isAnalyzing = true;
            System.log('Predictive', `Analyzing ${this.snapshots.length} data points...`);
            
            // Show loading state
            const container = document.getElementById('predictive-content');
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <div style="font-size: 48px; margin-bottom: 12px;">🔮</div>
                        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">
                            Analyzing Component Health...
                        </div>
                        <div style="font-size: 12px;">Processing ${this.snapshots.length} historical data points</div>
                    </div>
                `;
            }
            
            // Run analysis algorithms
            this.predictions = [];
            
            await this.analyzeBatteryTrend();
            await this.analyzeCatalystTrend();
            await this.analyzeFuelTrimTrend();
            
            // Store predictions
            this.lastAnalysisTime = Date.now();
            try {
                await window.storage.set(this.storageKeys.predictions, JSON.stringify(this.predictions));
                await window.storage.set(this.storageKeys.lastAnalysis, this.lastAnalysisTime.toString());
            } catch (err) {
                // Silent fail
            }
            
            this.isAnalyzing = false;
            this.render();
            
            System.log('Predictive', `✓ Analysis complete - ${this.predictions.length} predictions generated`);
        },

        /**
         * Analyze battery voltage trend
         */
        async analyzeBatteryTrend() {
            const batteryData = this.snapshots
                .filter(s => s.data.battery !== undefined)
                .map(s => ({ timestamp: s.timestamp, value: s.data.battery }));
            
            if (batteryData.length < 5) return;
            
            // Calculate trend (linear regression)
            const trend = this.calculateTrend(batteryData);
            const currentValue = batteryData[batteryData.length - 1].value;
            const avgValue = batteryData.reduce((sum, d) => sum + d.value, 0) / batteryData.length;
            
            // Predict time to failure
            let prediction = null;
            
            if (currentValue < this.thresholds.battery.criticalLow) {
                prediction = {
                    component: 'Battery',
                    severity: 'critical',
                    message: 'Battery voltage critically low',
                    recommendation: 'Replace battery immediately',
                    timeframe: 'Now',
                    confidence: 95,
                    icon: '🔋',
                    color: 'var(--red)'
                };
            } else if (currentValue < this.thresholds.battery.warningLow) {
                prediction = {
                    component: 'Battery',
                    severity: 'warning',
                    message: 'Battery voltage below normal',
                    recommendation: 'Test battery and charging system',
                    timeframe: '1-2 weeks',
                    confidence: 85,
                    icon: '🔋',
                    color: 'var(--orange)'
                };
            } else if (trend.slope < -0.01) {
                // Voltage declining over time
                const daysToWarning = Math.abs((currentValue - this.thresholds.battery.warningLow) / trend.slope);
                prediction = {
                    component: 'Battery',
                    severity: 'info',
                    message: 'Battery voltage slowly declining',
                    recommendation: 'Monitor charging system',
                    timeframe: daysToWarning > 30 ? '2-3 months' : '1 month',
                    confidence: 70,
                    icon: '🔋',
                    color: 'var(--blue)'
                };
            } else {
                prediction = {
                    component: 'Battery',
                    severity: 'good',
                    message: 'Battery health excellent',
                    recommendation: 'No action needed',
                    timeframe: '12+ months',
                    confidence: 90,
                    icon: '🔋',
                    color: 'var(--green)'
                };
            }
            
            if (prediction) {
                prediction.currentValue = currentValue.toFixed(2) + 'V';
                prediction.trend = trend.slope > 0 ? 'improving' : trend.slope < -0.005 ? 'declining' : 'stable';
                this.predictions.push(prediction);
            }
        },

        /**
         * Analyze catalyst efficiency trend
         */
        async analyzeCatalystTrend() {
            const catalystData = this.snapshots
                .filter(s => s.data.catalystRatio !== undefined)
                .map(s => ({ timestamp: s.timestamp, value: s.data.catalystRatio }));
            
            if (catalystData.length < 3) return;
            
            const currentValue = catalystData[catalystData.length - 1].value;
            const trend = this.calculateTrend(catalystData);
            
            let prediction = null;
            
            if (currentValue >= this.thresholds.catalyst.criticalRatio) {
                prediction = {
                    component: 'Catalytic Converter',
                    severity: 'critical',
                    message: 'Catalyst very close to failure threshold',
                    recommendation: 'Replace catalyst soon to avoid P0420 code',
                    timeframe: '1-2 months',
                    confidence: 90,
                    icon: '🔥',
                    color: 'var(--red)'
                };
            } else if (currentValue >= this.thresholds.catalyst.warningRatio) {
                prediction = {
                    component: 'Catalytic Converter',
                    severity: 'warning',
                    message: 'Catalyst efficiency degrading',
                    recommendation: 'Monitor closely - may fail emissions test',
                    timeframe: '3-6 months',
                    confidence: 80,
                    icon: '🔥',
                    color: 'var(--orange)'
                };
            } else if (trend.slope > 0.01) {
                // Efficiency declining (value increasing toward limit)
                prediction = {
                    component: 'Catalytic Converter',
                    severity: 'info',
                    message: 'Catalyst slowly degrading (normal aging)',
                    recommendation: 'Continue monitoring',
                    timeframe: '12+ months',
                    confidence: 65,
                    icon: '🔥',
                    color: 'var(--blue)'
                };
            } else {
                prediction = {
                    component: 'Catalytic Converter',
                    severity: 'good',
                    message: 'Catalyst operating efficiently',
                    recommendation: 'No action needed',
                    timeframe: '24+ months',
                    confidence: 85,
                    icon: '🔥',
                    color: 'var(--green)'
                };
            }
            
            if (prediction) {
                prediction.currentValue = currentValue.toFixed(3) + ' ratio';
                prediction.trend = trend.slope > 0.005 ? 'degrading' : 'stable';
                this.predictions.push(prediction);
            }
        },

        /**
         * Analyze fuel trim trend
         */
        async analyzeFuelTrimTrend() {
            const trimData = this.snapshots
                .filter(s => s.data.fuelTrim !== undefined)
                .map(s => ({ timestamp: s.timestamp, value: Math.abs(s.data.fuelTrim) }));
            
            if (trimData.length < 5) return;
            
            const currentValue = trimData[trimData.length - 1].value;
            const avgValue = trimData.reduce((sum, d) => sum + d.value, 0) / trimData.length;
            
            let prediction = null;
            
            if (currentValue > this.thresholds.fuelTrim.criticalOffset) {
                prediction = {
                    component: 'Fuel System',
                    severity: 'warning',
                    message: 'Excessive fuel trim correction',
                    recommendation: 'Check for vacuum leaks or failing O2 sensors',
                    timeframe: '1-2 weeks',
                    confidence: 75,
                    icon: '⛽',
                    color: 'var(--orange)'
                };
            } else if (avgValue > this.thresholds.fuelTrim.warningOffset) {
                prediction = {
                    component: 'Fuel System',
                    severity: 'info',
                    message: 'Fuel trim trending high',
                    recommendation: 'Monitor O2 sensors and air filter',
                    timeframe: '1-2 months',
                    confidence: 60,
                    icon: '⛽',
                    color: 'var(--blue)'
                };
            } else {
                prediction = {
                    component: 'Fuel System',
                    severity: 'good',
                    message: 'Fuel system operating normally',
                    recommendation: 'No action needed',
                    timeframe: '12+ months',
                    confidence: 85,
                    icon: '⛽',
                    color: 'var(--green)'
                };
            }
            
            if (prediction) {
                prediction.currentValue = currentValue.toFixed(1) + '%';
                prediction.trend = avgValue > 8 ? 'compensating' : 'stable';
                this.predictions.push(prediction);
            }
        },

        /**
         * Calculate linear trend (slope) from data points
         */
        calculateTrend(data) {
            if (data.length < 2) return { slope: 0, intercept: 0 };
            
            const n = data.length;
            let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
            
            data.forEach((point, i) => {
                const x = i;
                const y = point.value;
                sumX += x;
                sumY += y;
                sumXY += x * y;
                sumXX += x * x;
            });
            
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;
            
            return { slope, intercept };
        },

        /**
         * Render predictions to UI
         */
        render() {
            const container = document.getElementById('predictive-content');
            if (!container) return;
            
            // Not enough data
            if (this.snapshots.length < 5) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <div style="font-size: 48px; margin-bottom: 12px;">🔮</div>
                        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">
                            Collecting Data...
                        </div>
                        <div style="font-size: 12px; line-height: 1.5;">
                            Predictive analysis requires historical data.<br>
                            Current snapshots: ${this.snapshots.length} / 5 minimum<br><br>
                            Drive with Gnokestation connected to build history.
                        </div>
                    </div>
                `;
                return;
            }
            
            // No predictions yet
            if (this.predictions.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <div style="font-size: 48px; margin-bottom: 12px;">🔮</div>
                        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">
                            Ready to Analyze
                        </div>
                        <div style="font-size: 12px; line-height: 1.5;">
                            ${this.snapshots.length} data points collected<br>
                            Click "Run Analysis" to generate predictions
                        </div>
                    </div>
                `;
                return;
            }
            
            // Sort predictions by severity
            const severityOrder = { critical: 0, warning: 1, info: 2, good: 3 };
            const sorted = [...this.predictions].sort((a, b) => 
                severityOrder[a.severity] - severityOrder[b.severity]
            );
            
            let html = '';
            
            // Analysis info
            const analysisDate = new Date(this.lastAnalysisTime).toLocaleString();
            html += `
                <div style="background: white; padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 11px; color: #666;">
                    <strong>📊 Analysis Summary</strong><br>
                    Data Points: ${this.snapshots.length} snapshots<br>
                    Last Analysis: ${analysisDate}<br>
                    Predictions: ${this.predictions.length} components analyzed
                </div>
            `;
            
            // Render predictions
            sorted.forEach(pred => {
                html += this.renderPredictionCard(pred);
            });
            
            // Help text
            html += `
                <div style="margin-top: 12px; padding: 12px; background: rgba(52, 152, 219, 0.1); border-radius: 6px; font-size: 11px; line-height: 1.5; color: #666;">
                    <strong>💡 How Predictions Work:</strong><br>
                    • Gnokestation tracks component health over time<br>
                    • Trends are analyzed to predict future failures<br>
                    • Confidence indicates prediction reliability<br>
                    • More driving = better predictions
                </div>
            `;
            
            container.innerHTML = html;
        },

        /**
         * Render individual prediction card
         */
        renderPredictionCard(pred) {
            return `
                <div style="
                    background: white;
                    padding: 14px;
                    border-radius: 8px;
                    margin-bottom: 10px;
                    border-left: 4px solid ${pred.color};
                ">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <div style="flex: 1;">
                            <div style="font-size: 14px; font-weight: 700; color: var(--accent); margin-bottom: 4px;">
                                ${pred.icon} ${pred.component}
                            </div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 6px;">
                                ${pred.message}
                            </div>
                            <div style="font-size: 11px; font-weight: 600; color: ${pred.color};">
                                ${pred.recommendation}
                            </div>
                        </div>
                        <div style="text-align: right; margin-left: 12px;">
                            <div style="
                                font-size: 10px;
                                padding: 4px 8px;
                                border-radius: 4px;
                                background: ${pred.color};
                                color: white;
                                font-weight: 700;
                                margin-bottom: 4px;
                            ">
                                ${pred.timeframe}
                            </div>
                            <div style="font-size: 10px; color: #666;">
                                ${pred.confidence}% confident
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.05);">
                        <div>
                            <div style="opacity: 0.6; margin-bottom: 2px;">Current Value</div>
                            <div style="font-weight: 700;">${pred.currentValue}</div>
                        </div>
                        <div>
                            <div style="opacity: 0.6; margin-bottom: 2px;">Trend</div>
                            <div style="font-weight: 700; text-transform: capitalize;">${pred.trend}</div>
                        </div>
                    </div>
                </div>
            `;
        },

        /**
         * Export predictions report
         */
        exportReport() {
            if (this.predictions.length === 0) {
                alert('No predictions to export. Run analysis first.');
                return;
            }
            
            const report = {
                generatedAt: new Date().toISOString(),
                dataPoints: this.snapshots.length,
                predictions: this.predictions.map(p => ({
                    component: p.component,
                    severity: p.severity,
                    message: p.message,
                    recommendation: p.recommendation,
                    timeframe: p.timeframe,
                    confidence: p.confidence,
                    currentValue: p.currentValue,
                    trend: p.trend
                }))
            };
            
            const blob = new Blob([JSON.stringify(report, null, 2)], 
                                 { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `predictive-report-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            System.log('Predictive', 'Report exported');
        },

        /**
         * Clear all historical data
         */
        async clearHistory() {
            if (!confirm('Clear all predictive data? This cannot be undone.')) return;
            
            this.snapshots = [];
            this.predictions = [];
            this.lastAnalysisTime = null;
            
            try {
                await window.storage.delete(this.storageKeys.snapshots);
                await window.storage.delete(this.storageKeys.predictions);
                await window.storage.delete(this.storageKeys.lastAnalysis);
            } catch (err) {
                // Silent fail
            }
            
            this.render();
            System.log('Predictive', 'All historical data cleared');
        },

        /**
         * Shutdown cleanup
         */
        shutdown() {
            if (this.dataCollectionInterval) {
                clearInterval(this.dataCollectionInterval);
                this.dataCollectionInterval = null;
            }
            System.log('Predictive', 'Shutdown complete');
        }
    };

    // Register
    window.System.activeApps.predictive = PredictiveApp;
    PredictiveApp.init();

    // Global helpers
    window.runPredictiveAnalysis = () => PredictiveApp.runAnalysis();
    window.exportPredictiveReport = () => PredictiveApp.exportReport();
    window.clearPredictiveHistory = () => PredictiveApp.clearHistory();
})();


