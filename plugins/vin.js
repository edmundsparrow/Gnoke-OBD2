/**
 * Gnokestation VIN Reader v1.0
 * 
 * VIN (Vehicle Identification Number) is a 17-character code that uniquely
 * identifies every vehicle manufactured since 1981.
 * 
 * Uses Mode 09 (Vehicle Information) to read:
 * - VIN (PID 02)
 * - Calibration ID (PID 04) - ECU software version
 * - CVN (Calibration Verification Number) (PID 06)
 * - ECU Name (PID 0A)
 * 
 * This is useful for:
 * - Verifying vehicle identity before purchase
 * - Checking for recalls
 * - Identifying correct parts
 * - Verifying ECU reflash/tune status
 */

(() => {
    const VINApp = {
        id: 'vin',
        
        // Vehicle information
        vehicleInfo: {
            vin: null,
            calibrationID: null,
            cvn: null,
            ecuName: null,
            
            // Decoded VIN information
            manufacturer: null,
            country: null,
            year: null,
            plant: null,
            serial: null
        },

        /**
         * Initialize VIN reader
         */
        init() {
            System.log('VIN', 'Initializing Vehicle Information Reader...');
            System.log('VIN', '✓ Ready');
        },

        /**
         * Read complete vehicle information
         */
        async readVehicleInfo() {
            if (window.isSimulating) {
                this.renderSimulatedVIN();
                return;
            }

            try {
                System.log('VIN', 'Reading vehicle information...');
                
                // Read VIN (Mode 09 PID 02)
                await this.readVIN();
                
                // Try to read additional info (not all vehicles support these)
                await this.readCalibrationID();
                await this.readECUName();
                
                this.decodeVIN();
                this.render();
                
                System.log('VIN', `✓ Vehicle identified: ${this.vehicleInfo.vin}`);
                
            } catch (err) {
                System.log('VIN', `Error: ${err.message}`);
                alert('Failed to read vehicle information.\n\nSome vehicles do not support VIN reading via OBD-II.');
            }
        },

        /**
         * Read VIN (Mode 09 PID 02)
         */
        async readVIN() {
            try {
                // Request VIN - Mode 09, PID 02
                const raw = await window.obd.sendCommand('0902');
                
                // Parse response
                // Format: 49 02 01 [VIN bytes] 49 02 02 [more VIN bytes] ...
                // The VIN is sent in multiple frames
                const bytes = window.parseOBDResponse(raw, '4902');
                
                if (!bytes || bytes.length < 17) {
                    throw new Error('Invalid VIN response');
                }
                
                // Extract VIN characters (skip frame headers)
                let vin = '';
                let dataIndex = 0;
                
                // VIN is typically in bytes after the header
                // Skip the first 2 bytes (01 = frame number, count)
                for (let i = 2; i < bytes.length && vin.length < 17; i++) {
                    const byte = bytes[i];
                    // VIN uses ASCII characters A-Z, 0-9
                    if (byte >= 48 && byte <= 90 && byte !== 73 && byte !== 79 && byte !== 81) {
                        // I, O, Q are not used in VINs
                        vin += String.fromCharCode(byte);
                    }
                }
                
                if (vin.length === 17) {
                    this.vehicleInfo.vin = vin;
                } else {
                    throw new Error('VIN length invalid');
                }
                
            } catch (err) {
                System.log('VIN', 'VIN reading not supported by vehicle');
                throw err;
            }
        },

        /**
         * Read Calibration ID (Mode 09 PID 04)
         */
        async readCalibrationID() {
            try {
                const raw = await window.obd.sendCommand('0904');
                const bytes = window.parseOBDResponse(raw, '4904');
                
                if (bytes && bytes.length > 2) {
                    let calID = '';
                    for (let i = 2; i < bytes.length; i++) {
                        if (bytes[i] >= 32 && bytes[i] <= 126) {
                            calID += String.fromCharCode(bytes[i]);
                        }
                    }
                    this.vehicleInfo.calibrationID = calID.trim() || null;
                }
            } catch (err) {
                // Not supported, skip
            }
        },

        /**
         * Read ECU Name (Mode 09 PID 0A)
         */
        async readECUName() {
            try {
                const raw = await window.obd.sendCommand('090A');
                const bytes = window.parseOBDResponse(raw, '490A');
                
                if (bytes && bytes.length > 2) {
                    let ecuName = '';
                    for (let i = 2; i < bytes.length; i++) {
                        if (bytes[i] >= 32 && bytes[i] <= 126) {
                            ecuName += String.fromCharCode(bytes[i]);
                        }
                    }
                    this.vehicleInfo.ecuName = ecuName.trim() || null;
                }
            } catch (err) {
                // Not supported, skip
            }
        },

        /**
         * Decode VIN to extract useful information
         */
        decodeVIN() {
            const vin = this.vehicleInfo.vin;
            if (!vin || vin.length !== 17) return;

            // World Manufacturer Identifier (positions 1-3)
            const wmi = vin.substring(0, 3);
            this.vehicleInfo.manufacturer = this.getManufacturer(wmi);
            this.vehicleInfo.country = this.getCountry(vin[0]);

            // Model Year (position 10)
            this.vehicleInfo.year = this.getModelYear(vin[9]);

            // Plant Code (position 11)
            this.vehicleInfo.plant = vin[10];

            // Serial Number (positions 12-17)
            this.vehicleInfo.serial = vin.substring(11, 17);
        },

        /**
         * Get manufacturer from WMI code
         */
        getManufacturer(wmi) {
            const manufacturers = {
                '1FA': 'Ford',
                '1FB': 'Ford',
                '1FC': 'Ford',
                '1FD': 'Ford',
                '1FM': 'Ford (Truck)',
                '1FT': 'Ford (Truck)',
                '1G': 'General Motors',
                '1GC': 'Chevrolet (Truck)',
                '1GM': 'Pontiac',
                '1GN': 'Chevrolet',
                '1HG': 'Honda',
                '1J4': 'Jeep',
                '1L': 'Lincoln',
                '1ME': 'Mercury',
                '1N': 'Nissan',
                '1VW': 'Volkswagen',
                '1YV': 'Mazda',
                '2C3': 'Chrysler',
                '2FA': 'Ford (Canada)',
                '2G': 'General Motors (Canada)',
                '2HG': 'Honda (Canada)',
                '2HM': 'Hyundai',
                '2T': 'Toyota (Canada)',
                '3FA': 'Ford (Mexico)',
                '3G': 'General Motors (Mexico)',
                '3HG': 'Honda (Mexico)',
                '3N': 'Nissan (Mexico)',
                '3VW': 'Volkswagen (Mexico)',
                '4F': 'Mazda',
                '4S': 'Subaru',
                '4T': 'Toyota',
                '5F': 'Honda (USA)',
                '5L': 'Lincoln',
                '5N': 'Nissan',
                '5T': 'Toyota',
                'JA': 'Isuzu',
                'JF': 'Fuji (Subaru)',
                'JH': 'Honda',
                'JM': 'Mazda',
                'JN': 'Nissan',
                'JT': 'Toyota',
                'KL': 'Daewoo',
                'KM': 'Hyundai',
                'KN': 'Kia',
                'SAJ': 'Jaguar',
                'SAL': 'Land Rover',
                'SAR': 'Rover',
                'SCC': 'Lotus',
                'SCE': 'DeLorean',
                'SDB': 'Peugeot',
                'TRU': 'Audi',
                'TSM': 'Suzuki',
                'VF': 'Peugeot/Citroën',
                'VW': 'Volkswagen',
                'WAU': 'Audi',
                'WBA': 'BMW',
                'WBS': 'BMW M',
                'WDB': 'Mercedes-Benz',
                'WDC': 'DaimlerChrysler',
                'WDD': 'Mercedes-Benz',
                'WMW': 'MINI',
                'WP0': 'Porsche',
                'WVW': 'Volkswagen',
                'YK1': 'Saab',
                'YS3': 'Saab',
                'YV': 'Volvo',
                'ZAM': 'Maserati',
                'ZAR': 'Alfa Romeo',
                'ZFA': 'Fiat',
                'ZFF': 'Ferrari',
                'ZHW': 'Lamborghini'
            };

            // Try full WMI first
            if (manufacturers[wmi]) return manufacturers[wmi];
            
            // Try first 2 characters
            const wmi2 = wmi.substring(0, 2);
            if (manufacturers[wmi2]) return manufacturers[wmi2];
            
            // Try first character
            const wmi1 = wmi[0];
            if (manufacturers[wmi1]) return manufacturers[wmi1];
            
            return 'Unknown';
        },

        /**
         * Get country from first VIN character
         */
        getCountry(char) {
            const ranges = {
                '1': 'United States',
                '2': 'Canada',
                '3': 'Mexico',
                '4': 'United States',
                '5': 'United States',
                '6': 'Australia',
                '7': 'New Zealand',
                '8': 'South America',
                '9': 'Brazil',
                'A': 'South Africa',
                'J': 'Japan',
                'K': 'South Korea',
                'L': 'China',
                'M': 'India',
                'S': 'United Kingdom',
                'T': 'Czech Republic',
                'V': 'France/Spain',
                'W': 'Germany',
                'Y': 'Sweden/Finland',
                'Z': 'Italy'
            };

            return ranges[char] || 'Unknown';
        },

        /**
         * Decode model year from position 10
         */
        getModelYear(char) {
            const yearCodes = {
                'A': 1980, 'B': 1981, 'C': 1982, 'D': 1983, 'E': 1984,
                'F': 1985, 'G': 1986, 'H': 1987, 'J': 1988, 'K': 1989,
                'L': 1990, 'M': 1991, 'N': 1992, 'P': 1993, 'R': 1994,
                'S': 1995, 'T': 1996, 'V': 1997, 'W': 1998, 'X': 1999,
                'Y': 2000, '1': 2001, '2': 2002, '3': 2003, '4': 2004,
                '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009,
                'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014,
                'F': 2015, 'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019,
                'L': 2020, 'M': 2021, 'N': 2022, 'P': 2023, 'R': 2024,
                'S': 2025, 'T': 2026, 'V': 2027, 'W': 2028, 'X': 2029,
                'Y': 2030
            };

            return yearCodes[char] || 'Unknown';
        },

        /**
         * Render vehicle information to UI
         */
        render() {
            const container = document.getElementById('vin-content');
            if (!container) return;

            const info = this.vehicleInfo;

            if (!info.vin) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <div style="font-size: 48px; margin-bottom: 12px;">🚗</div>
                        <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">
                            No Vehicle Information
                        </div>
                        <div style="font-size: 12px; line-height: 1.5;">
                            Click "Read VIN" to identify vehicle.
                        </div>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <!-- VIN Display -->
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 12px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,.08);">
                    <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; opacity: 0.6; margin-bottom: 8px;">
                        Vehicle Identification Number
                    </div>
                    <div style="font-size: 24px; font-weight: 700; font-family: monospace; letter-spacing: 2px; color: var(--accent); margin-bottom: 12px;">
                        ${info.vin}
                    </div>
                    <button onclick="copyVIN()" class="btn-secondary" style="border-color: var(--blue); color: var(--blue);">
                        📋 Copy VIN
                    </button>
                </div>

                <!-- Decoded Information -->
                <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
                    <div style="font-size: 12px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; opacity: 0.7;">
                        Decoded Information
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        ${this.renderInfoCard('🏭 Manufacturer', info.manufacturer)}
                        ${this.renderInfoCard('🌍 Country', info.country)}
                        ${this.renderInfoCard('📅 Model Year', info.year)}
                        ${this.renderInfoCard('🔧 Plant Code', info.plant)}
                    </div>
                    
                    <div style="margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.02); border-radius: 6px;">
                        <div style="font-size: 10px; font-weight: 600; opacity: 0.6; margin-bottom: 4px;">
                            SERIAL NUMBER
                        </div>
                        <div style="font-size: 16px; font-weight: 700; font-family: monospace;">
                            ${info.serial}
                        </div>
                    </div>
                </div>

                <!-- ECU Information -->
                ${info.calibrationID || info.ecuName ? `
                    <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
                        <div style="font-size: 12px; font-weight: 700; margin-bottom: 12px; text-transform: uppercase; opacity: 0.7;">
                            ECU Information
                        </div>
                        
                        ${info.calibrationID ? `
                            <div style="margin-bottom: 12px;">
                                <div style="font-size: 10px; font-weight: 600; opacity: 0.6; margin-bottom: 4px;">
                                    CALIBRATION ID
                                </div>
                                <div style="font-size: 13px; font-family: monospace; color: var(--accent);">
                                    ${info.calibrationID}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${info.ecuName ? `
                            <div>
                                <div style="font-size: 10px; font-weight: 600; opacity: 0.6; margin-bottom: 4px;">
                                    ECU NAME
                                </div>
                                <div style="font-size: 13px; font-family: monospace; color: var(--accent);">
                                    ${info.ecuName}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}

                <!-- VIN Decoder Link -->
                <div style="background: rgba(52, 152, 219, 0.1); padding: 12px; border-radius: 6px; font-size: 11px; line-height: 1.5; color: #666;">
                    <strong>🔍 Want more details?</strong><br>
                    Use online VIN decoders to get complete vehicle specifications, recall information, and service history.
                </div>
            `;
        },

        /**
         * Render info card helper
         */
        renderInfoCard(label, value) {
            return `
                <div style="padding: 12px; background: rgba(0,0,0,0.02); border-radius: 6px;">
                    <div style="font-size: 10px; font-weight: 600; opacity: 0.6; margin-bottom: 4px;">
                        ${label}
                    </div>
                    <div style="font-size: 14px; font-weight: 700; color: var(--accent);">
                        ${value || 'Unknown'}
                    </div>
                </div>
            `;
        },

        /**
         * Generate simulated VIN for demo mode
         */
        renderSimulatedVIN() {
            // Simulate a 2019 Honda Civic
            this.vehicleInfo = {
                vin: '2HGFC2F59KH123456',
                calibrationID: 'AAHONDA1.2.3',
                cvn: null,
                ecuName: 'ENGINE CONTROL MODULE',
                manufacturer: 'Honda',
                country: 'Canada',
                year: 2019,
                plant: 'H',
                serial: '123456'
            };
            
            this.render();
            System.log('VIN', '✓ Demo VIN loaded');
        },

        /**
         * Copy VIN to clipboard
         */
        copyVIN() {
            if (!this.vehicleInfo.vin) return;
            
            navigator.clipboard.writeText(this.vehicleInfo.vin).then(() => {
                System.log('VIN', 'VIN copied to clipboard');
                alert('VIN copied to clipboard!');
            }).catch(() => {
                System.log('VIN', 'Failed to copy VIN');
            });
        },

        /**
         * Export vehicle info
         */
        exportInfo() {
            if (!this.vehicleInfo.vin) {
                alert('No vehicle information to export');
                return;
            }
            
            const exportData = {
                vin: this.vehicleInfo.vin,
                manufacturer: this.vehicleInfo.manufacturer,
                country: this.vehicleInfo.country,
                year: this.vehicleInfo.year,
                plant: this.vehicleInfo.plant,
                serial: this.vehicleInfo.serial,
                calibrationID: this.vehicleInfo.calibrationID,
                ecuName: this.vehicleInfo.ecuName,
                exportDate: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], 
                                 { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `vehicle-info-${this.vehicleInfo.vin}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            System.log('VIN', 'Vehicle information exported');
        },

        /**
         * Shutdown
         */
        shutdown() {
            System.log('VIN', 'Shutdown complete');
        }
    };

    // Register
    window.System.activeApps.vin = VINApp;
    VINApp.init();
    
    // Global helpers
    window.readVIN = () => VINApp.readVehicleInfo();
    window.copyVIN = () => VINApp.copyVIN();
    window.exportVINInfo = () => VINApp.exportInfo();
})();

