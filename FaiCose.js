

// CONFIGURAZIONE

const CONFIG = {
    API_BASE_URL: 'https://x8ki-letl-twmt.n7.xano.io/api:qI3RE1pI',
    CACHE_DURATION: 10 * 60 * 1000,
    DAY_NAMES: ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"],
    LOCALE: 'it-IT',
    RATE_LIMIT: {
        MAX_REQUESTS: 10,
        WINDOW_MS: 20000,
        requests: [],

        canMakeRequest() {
            const now = Date.now();
            this.requests = this.requests.filter(time => now - time < this.WINDOW_MS);
            return this.requests.length < this.MAX_REQUESTS;
        },

        recordRequest() {
            this.requests.push(Date.now());
        },

        getWaitTime() {
            if (this.requests.length === 0) return 0;
            const oldestRequest = Math.min(...this.requests);
            const timeSinceOldest = Date.now() - oldestRequest;
            return Math.max(0, this.WINDOW_MS - timeSinceOldest + 100);
        }
    }
};


// STATE MANAGEMENT

const state = {
    currentService: null,
    selectedDate: null,
    selectedHour: null,
    currentStep: 1,
    slotsCache: new Map(),
    currentDate: new Date()
};


// DOM REFERENCES

const DOM = {
    // Modal
    modalContainer: document.querySelector('.modal-container'),
    modalOverlay: document.querySelector('.modal-overlay'),
    bookingModal: document.querySelector('.booking-modal'),
    closeModalBtns: document.querySelectorAll('.modal-close-btn'),

    // Navigation
    steps: document.querySelectorAll(".step-content"),
    nextBtn: document.querySelector(".btn-next"),
    backBtn: document.querySelector(".btn-back"),
    indicators: document.querySelectorAll(".step"),

    // Form inputs
    numInput: document.querySelector("#numero-persone"),
    nameInput: document.querySelector('[wized="user-name-input"]'),
    emailInput: document.querySelector('[wized="user-email-input"]'),
    phoneInput: document.querySelector('[wized="user-phone-input"]'),
    gdprCheckbox: document.querySelector('#GDPR'),

    // Display elements
    peopleText: document.querySelector(".people-number-text .my-span-class"),
    totalText: document.querySelector(".total-text"),
    totalPrice: document.querySelector(".total-price"),
    extrasTitle: document.querySelector(".extras-title"),
    extrasContainer: document.querySelector(".extras-container"),

    // Calendar
    calendarGrid: document.querySelector('[wized="calendar-grid"]'),
    monthLabel: document.querySelector('[wized="calendar-month"]'),
    prevMonthBtn: document.querySelector('.prevmonthbtn'),
    nextMonthBtn: document.querySelector('.nextmonthbtn'),

    // Hours
    hoursGrid: document.querySelector('.div-block-8')
};

// UTILITY FUNCTIONS

const Utils = {
    formatDateISO(date) {
        if (!date) return "";
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },


    formatDateDDMMYYYY(date) {
        if (!date) return "";
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    },


    normalizeDate(date) {
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        return normalized;
    },

    createTimestamp(date, hour) {
        return new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            hour, 0, 0, 0
        ).getTime();
    },


    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    showError(message, duration = 5000) {
        alert(message);
        console.error('❌', message);

        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 400px;
            font-size: 14px;
            line-height: 1.5;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    showInfo(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #3b82f6;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 400px;
            font-size: 14px;
            line-height: 1.5;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.3s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },


    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    isDateInPast(date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        return checkDate < today;
    },

    // CORREZIONE: Normalizzazione data più robusta
    normalizeDate(date) {
        if (!(date instanceof Date)) {
            date = new Date(date);
        }
        const normalized = new Date(date);
        normalized.setHours(0, 0, 0, 0);
        return normalized;
    }
};

// API SERVICE

const API = {
    async request(endpoint, options = {}) {
        const url = `${CONFIG.API_BASE_URL}${endpoint}`;

        if (!CONFIG.RATE_LIMIT.canMakeRequest()) {
            const waitTime = CONFIG.RATE_LIMIT.getWaitTime();
            const seconds = Math.ceil(waitTime / 1000);
            console.warn(`⏳ Rate limit raggiunto. Attendo ${seconds}s...`);
            Utils.showInfo(`⏳ Attendi ${seconds} secondi...`, waitTime);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        try {
            CONFIG.RATE_LIMIT.recordRequest();

            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch {
                    throw new Error(`API Error ${response.status}: ${errorText}`);
                }

                if (errorData.code === 'ERROR_CODE_TOO_MANY_REQUESTS') {
                    console.error('❌ Rate limit Xano superato');
                    throw new Error('Troppe richieste. Attendi 20 secondi e riprova.');
                }

                throw new Error(`API Error ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API Request failed: ${endpoint}`, error);
            throw error;
        }
    },

    async getServiceById(serviceId) {
        const cacheKey = `service_${serviceId}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            const data = JSON.parse(cached);
            if (Date.now() - data._cached < 3600000) {
                return data.service;
            }
        }

        const service = await this.request(`/services/${serviceId}`);

        sessionStorage.setItem(cacheKey, JSON.stringify({
            service,
            _cached: Date.now()
        }));

        return service;
    },

    async getServiceBySlug(slug) {
        const cacheKey = `service_${slug}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            const data = JSON.parse(cached);
            if (Date.now() - data._cached < 3600000) {
                console.log('✅ Servizio dalla cache');
                return data.service;
            }
        }

        const service = await this.request(`/services/slug/${slug}`);

        if (service.artisan_id) {
            try {
                const artisan = await this.request(`/artisan/${service.artisan_id}`);
                service._artisan = artisan;

                console.log("👨‍🔧 Artigiano caricato:", artisan);

                // ⭐⭐ DEBUG COMPLETO: Mostra TUTTE le availability rules
                console.log("📋 TUTTE le availability rules dell'artigiano:");
                artisan._artisan_availability_rules_of_artisan.forEach((rule, index) => {
                    console.log(`=== REGOLA ${index + 1} (ID: ${rule.id}) ===`);
                    console.log("Start Date:", rule.start_date);
                    console.log("End Date:", rule.end_date);
                    console.log("Daily Schedules:", rule.daily_schedules);
                    console.log("Lunghezza Daily Schedules:", rule.daily_schedules?.length);
                    console.log("Tipo Daily Schedules:", typeof rule.daily_schedules);

                    // Controllo specifico per array vuoti
                    if (rule.daily_schedules && rule.daily_schedules.length === 0) {
                        console.log("🚨 QUESTA REGOLA HA DAILY_SCHEDULES VUOTO!");
                    }
                    if (Array.isArray(rule.daily_schedules) && rule.daily_schedules.length === 1 &&
                        Array.isArray(rule.daily_schedules[0]) && rule.daily_schedules[0].length === 0) {
                        console.log("🚨 QUESTA REGOLA HA DAILY_SCHEDULES [[]] (array di array vuoto)!");
                    }
                    console.log("=== FINE REGOLA ===");
                });

                // ⭐⭐ TEST: Quale rule per quale data?
                const findRuleForDate = (targetDate) => {
                    return artisan._artisan_availability_rules_of_artisan.find(rule => {
                        const startDate = rule.start_date ? new Date(rule.start_date) : null;
                        const endDate = rule.end_date ? new Date(rule.end_date) : null;

                        if (startDate && endDate) {
                            return targetDate >= startDate && targetDate <= endDate;
                        } else if (startDate) {
                            return targetDate >= startDate;
                        } else if (endDate) {
                            return targetDate <= endDate;
                        }
                        return true;
                    });
                };

                const testDates = [
                    new Date('2025-11-12'), // Oggi
                    new Date('2025-12-01'), // Inizio ID 2
                    new Date('2025-12-15'), // Fine ID 2  
                    new Date('2025-12-17'), // Inizio ID 3
                    new Date('2025-12-25'), // Durante ID 3
                    new Date('2026-01-15')  // Durante ID 3
                ];

                console.log("🔍 TEST: Quale rule per quale data?");
                testDates.forEach(testDate => {
                    const rule = findRuleForDate(testDate);
                    console.log(`📅 ${Utils.formatDateDDMMYYYY(testDate)} → Rule ID: ${rule?.id || 'Nessuna'}`);
                });

                // ⭐⭐ NUOVA LOGICA: Non scegliere una rule fissa, ma salva tutte le rules
                if (artisan._artisan_availability_rules_of_artisan?.length > 0) {
                    console.log("✅ Rules disponibili, verranno scelte dinamicamente per data");
                    service._availability = null; // Non settare una rule fissa!

                    // Salva TUTTE le rules nel service per usarle dopo dinamicamente
                    service._all_availability_rules = artisan._artisan_availability_rules_of_artisan;
                    console.log("📦 Tutte le rules salvate per selezione dinamica:", service._all_availability_rules.map(r => r.id));
                } else {
                    console.log("❌ Nessuna regola di disponibilità per l'artigiano");
                    service._availability = null;
                    service._all_availability_rules = [];
                }

            } catch (error) {
                console.error("❌ Errore nel caricamento artigiano:", error);
                service._availability = null;
                service._all_availability_rules = [];
            }
        }

        sessionStorage.setItem(cacheKey, JSON.stringify({
            service,
            _cached: Date.now()
        }));

        return service;
    },


    async getSlots(serviceId, date) {
        const dateStr = Utils.formatDateISO(date);
        return await this.request(`/slot?service_id=${serviceId}&date=${dateStr}`);
    },

    async createBooking(bookingData) {
        return await this.request('/booking', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });
    },

    async createStripeCheckout(email, totalAmount, bookingId) {
        const response = await this.request('/api/create_stripe_checkout', {
            method: 'POST',
            body: JSON.stringify({
                email,
                total_amount: totalAmount,
                booking_id: bookingId
            })
        });

        if (response.url) return { redirect_url: response.url };
        if (response.redirect_url) return response;
        if (response.result?.url) return { redirect_url: response.result.url };
        if (response.session?.url) return { redirect_url: response.session.url };

        console.error('❌ Formato risposta Stripe non riconosciuto:', response);
        throw new Error('Risposta Stripe non valida: URL mancante');
    },

    async getServiceBookings(serviceId, date, hour) {
        const dateStr = Utils.formatDateISO(date);
        const timestamp = Utils.createTimestamp(date, hour) / 1000;
        return await this.request(`/bookings?service_id=${serviceId}&date=${dateStr}&start_time=${timestamp}`);
    },

    async getAllBookings() {
        try {
            console.log("📡 Chiamando endpoint /booking...");
            const response = await fetch(`${CONFIG.API_BASE_URL}/booking`);
            console.log("📊 Status response:", response.status);
            console.log("📊 Headers response:", response.headers);

            const text = await response.text();
            console.log("📊 Response text:", text);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            const result = JSON.parse(text);
            console.log("✅ Risposta endpoint /booking:", result);
            return result;

        } catch (error) {
            console.error("❌ Errore endpoint /booking:", error);
            return [];
        }
    },
    async getServiceBookings(serviceId, date, hour) {
        const dateStr = Utils.formatDateISO(date);
        let url = `/booking?service_id=${serviceId}&date=${dateStr}`;

        if (hour !== null) {
            const timestamp = Utils.createTimestamp(date, hour) / 1000;
            url += `&start_time=${timestamp}`;
        }

        return await this.request(url);
    }
};

// CACHE MANAGEMENT

const CacheManager = {

    generateKey(serviceId, date) {
        return `${serviceId}-${Utils.formatDateISO(date)}`;
    },


    get(serviceId, date) {
        const key = this.generateKey(serviceId, date);
        const cached = state.slotsCache.get(key);

        if (!cached) return null;

        if (Date.now() - cached.timestamp > CONFIG.CACHE_DURATION) {
            state.slotsCache.delete(key);
            return null;
        }

        return cached.data;
    },

    set(serviceId, date, data) {
        const key = this.generateKey(serviceId, date);
        state.slotsCache.set(key, {
            data,
            timestamp: Date.now()
        });
    },

    clear() {
        state.slotsCache.clear();
    },

    bookingCache: new Map(),

    // Cache per le prenotazioni dell'artigiano (durata 2 minuti)
    getArtisanBookings(artisanId, date) {
        const key = `artisan-${artisanId}-${Utils.formatDateISO(date)}`;
        const cached = this.bookingCache.get(key);

        if (cached && Date.now() - cached.timestamp < 120000) { // 2 minuti
            console.log('✅ Prenotazioni dalla cache');
            return cached.data;
        }
        return null;
    },

    setArtisanBookings(artisanId, date, data) {
        const key = `artisan-${artisanId}-${Utils.formatDateISO(date)}`;
        this.bookingCache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
};

// MODAL MANAGEMENT
const Modal = {
    open() {
        console.log('🔓 OPEN Modal - aggiungo classe no-scroll');
        DOM.modalContainer.style.display = 'flex';
        DOM.modalOverlay.style.display = 'flex';
        DOM.bookingModal.style.display = 'block';
        document.body.classList.add('no-scroll');
        console.log('Classi body dopo open:', document.body.className);
    },

    close() {
        console.log('🔒 CLOSE Modal - rimuovo classe no-scroll');
        DOM.modalContainer.style.display = 'none';
        DOM.modalOverlay.style.display = 'none';
        DOM.bookingModal.style.display = 'none';
        document.body.classList.remove('no-scroll');
        console.log('Classi body dopo close:', document.body.className);
        StepNavigation.goToStep(1);
        setTimeout(() => {
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.width = '';
            document.body.style.height = '';
        }, 50);
    }
};


// STEP NAVIGATION
const StepNavigation = {
    goToStep(step) {
        state.currentStep = step;

        DOM.steps.forEach((el, index) => {
            el.style.display = (index + 1 === step) ? "flex" : "none";
        });

        DOM.indicators.forEach((indicator, index) => {
            indicator.classList.toggle("active", index + 1 <= step);
        });

        DOM.backBtn.style.display = (step > 1) ? "inline-block" : "none";
        DOM.nextBtn.textContent = (step === DOM.steps.length) ? "Prenota e paga" : "Successivo";

        if (step === DOM.steps.length) {
            RecapManager.update();
        }
    },

    async next() {
        const totalSteps = DOM.steps.length;

        if (!this.validateCurrentStep()) {
            return;
        }

        if (state.currentStep < totalSteps) {
            this.goToStep(state.currentStep + 1);
        } else {
            await BookingManager.submit();
        }
    },

    back() {
        if (state.currentStep > 1) {
            this.goToStep(state.currentStep - 1);
        }
    },

    validateCurrentStep() {
        if (state.currentStep === 1) {
            if (!state.selectedDate || state.selectedHour === null) {
                Utils.showError("Per favore seleziona una data e un orario.");
                return false;
            }

            const numPeople = parseInt(DOM.numInput.value) || 1;
            const maxCapacity = state.currentService.max_capacity_per_slot;

            if (numPeople > maxCapacity) {
                Utils.showError(`Numero di persone superiore alla capacità massima (${maxCapacity})`);
                return false;
            }
        }

        if (state.currentStep === 3) {
            if (!DOM.nameInput.value || !DOM.emailInput.value) {
                Utils.showError("Per favore compila i campi obbligatori: Nome e Email");
                return false;
            }

            if (!Utils.isValidEmail(DOM.emailInput.value)) {
                Utils.showError("Inserisci un indirizzo email valido");
                return false;
            }

            if (!DOM.gdprCheckbox.checked) {
                Utils.showError("Devi accettare il trattamento dei dati personali per procedere");
                return false;
            }
        }
        return true;
    }
};


// CALENDAR MANAGER

const CalendarManager = {
    selectDate(date) {
        state.selectedDate = date;
        state.selectedHour = null;

        this.render();
        HoursManager.render();

        // Aggiorna input persone e pricing
        if (DOM.numInput && state.currentService?.max_capacity_per_slot) {
            DOM.numInput.setAttribute('max', state.currentService.max_capacity_per_slot);
            DOM.numInput.setAttribute('title', `Seleziona tra 1 e ${state.currentService.max_capacity_per_slot} persone`);
            PricingManager.update();
        }
    },


    render() {
        if (!DOM.calendarGrid || !state.currentService) return;

        DOM.calendarGrid.innerHTML = '';

        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();

        DOM.monthLabel.textContent = state.currentDate.toLocaleString(CONFIG.LOCALE, {
            month: 'long',
            year: 'numeric'
        });

        const lastDay = new Date(year, month + 1, 0);
        const today = Utils.normalizeDate(new Date());
        const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;

        // ⭐⭐ MODIFICA: Ora getAvailabilityRules ritorna allRules
        const { defaultDays, specialDays, availStart, availEnd, allRules } = this.getAvailabilityRules();

        let firstSelectable = null;

        for (let i = 0; i < firstDayOfWeek; i++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.classList.add('div-block-6', 'empty-day');
            DOM.calendarGrid.appendChild(emptyDiv);
        }

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            const dayNum = date.getDay();
            const dayOfWeekStr = CONFIG.DAY_NAMES[(dayNum + 6) % 7];

            // ⭐⭐ MODIFICA: Passa allRules a isDaySelectable
            const isSelectable = this.isDaySelectable(
                date,
                today,
                dayOfWeekStr,
                defaultDays,
                specialDays,
                availStart,
                availEnd,
                allRules  // ⭐⭐ PASSIAMO tutte le rules
            );

            const dateDiv = this.createDayElement(day, dayOfWeekStr, date, isSelectable);

            if (isSelectable && !firstSelectable) {
                firstSelectable = dateDiv;
            }

            DOM.calendarGrid.appendChild(dateDiv);
        }

        if (!state.selectedDate && firstSelectable) {
            firstSelectable.click();
        }
    },

    // Aggiungi questo metodo a CalendarManager
    isPeriodFullyBlocked(rule, date) {
        if (!this.isRuleEmpty(rule)) return false;

        const startDate = rule.start_date ? new Date(rule.start_date) : null;
        const endDate = rule.end_date ? new Date(rule.end_date) : null;
        const checkDate = Utils.normalizeDate(date);

        if (startDate && endDate) {
            return checkDate >= startDate && checkDate <= endDate;
        } else if (startDate) {
            return checkDate >= startDate;
        } else if (endDate) {
            return checkDate <= endDate;
        }

        return true; // Se non ci sono date, blocca tutto
    },

getAvailabilityRules() {
    // ⭐ GESTIONE CACHE: Se non ci sono _all_availability_rules, usa la logica vecchia
    if (!state.currentService._all_availability_rules) {
        console.log("⚠️ Usando logica vecchia (cache)");
        const availability = state.currentService._availability;

        if (!availability) {
            console.log("❌ Nessuna disponibilità trovata per l'artigiano");
            return {
                defaultDays: state.currentService.working_days || [],
                specialDays: [],
                availStart: null,
                availEnd: null,
                allRules: [] // ⭐⭐ AGGIUNGI allRules
            };
        }

        // CODICE VECCHIO esistente
        const defaultDays = state.currentService.working_days || [];
        let specialDays = [];
        let availStart = null;
        let availEnd = null;

        if (availability.start_date) {
            availStart = new Date(availability.start_date);
            availStart.setHours(0, 0, 0, 0);
        }

        if (availability.end_date) {
            availEnd = new Date(availability.end_date);
            availEnd.setHours(23, 59, 59, 999);
        }

        if (availability.daily_schedules && availability.daily_schedules.length > 0) {
            try {
                let schedules = availability.daily_schedules;
                if (Array.isArray(schedules) && schedules.length > 0 && Array.isArray(schedules[0])) {
                    schedules = schedules.flat();
                }

                specialDays = schedules
                    .map(item => {
                        if (item && typeof item === 'object' && item.day) {
                            console.log("📅 Schedule trovato:", item);
                            return item.day;
                        }
                        return null;
                    })
                    .filter(day => day && CONFIG.DAY_NAMES.includes(day));

                console.log("📅 Giorni disponibili speciali:", specialDays);
            } catch (error) {
                console.error("❌ Errore nel processing daily_schedules:", error);
            }
        }

        return {
            defaultDays: state.currentService.working_days || [],
            specialDays: [], // ⭐⭐ FORZA specialDays vuoto
            availStart: null,
            availEnd: null,
            allRules: [] // ⭐⭐ AGGIUNGI allRules
        };
    }

    // ⭐⭐ NUOVA LOGICA: Selezione dinamica per data calendario
    const currentCalendarDate = state.currentDate;
    const allRules = state.currentService._all_availability_rules;

    console.log(`🔍 Cerco rule per data calendario: ${Utils.formatDateDDMMYYYY(currentCalendarDate)}`);
    console.log(`📦 Rules disponibili:`, allRules.map(r => r.id));

    if (!allRules || allRules.length === 0) {
        console.log("❌ Nessuna regola disponibile");
        return {
            defaultDays: state.currentService.working_days || [],
            specialDays: [],
            availStart: null,
            availEnd: null,
            allRules: [] // ⭐⭐ AGGIUNGI allRules
        };
    }

    const ruleForCalendarDate = allRules.find(rule => {
        const startDate = rule.start_date ? Utils.normalizeDate(new Date(rule.start_date)) : null;
        const endDate = rule.end_date ? Utils.normalizeDate(new Date(rule.end_date)) : null;
        const checkDate = Utils.normalizeDate(currentCalendarDate);

        if (startDate && endDate) {
            return checkDate >= startDate && checkDate <= endDate;
        } else if (startDate) {
            return checkDate >= startDate;
        } else if (endDate) {
            return checkDate <= endDate;
        }
        return true;
    });

    console.log(`📅 Rule trovata per ${Utils.formatDateDDMMYYYY(currentCalendarDate)}:`,
        ruleForCalendarDate ? `ID ${ruleForCalendarDate.id}` : "Nessuna");

    // Se non trova rule per questa data, usa la prima come fallback
    const activeRule = ruleForCalendarDate || allRules[0];

    if (activeRule) {
        console.log("✅ Rule attiva:", activeRule.id);
    }

    // ⭐⭐ PROCESSAMENTO MIGLIORATO
    const defaultDays = state.currentService.working_days || [];
    let specialDays = [];
    let availStart = null;
    let availEnd = null;

    if (activeRule) {
        if (activeRule.start_date) {
            availStart = new Date(activeRule.start_date);
            availStart.setHours(0, 0, 0, 0);
        }

        if (activeRule.end_date) {
            availEnd = new Date(activeRule.end_date);
            availEnd.setHours(23, 59, 59, 999);
        }

        // ⭐⭐ CONTROLLO PRINCIPALE: Se la rule è VUOTA, DISABILITA TUTTO
        if (this.isRuleEmpty(activeRule)) {
            console.log(`🚨 Rule ${activeRule.id} VUOTA - DISABILITA TUTTO il periodo`);
            return {
                defaultDays: [], // ⬅️ FORZA array vuoto
                specialDays: [], // ⬅️ FORZA array vuoto  
                availStart: availStart,
                availEnd: availEnd,
                allRules: allRules // ⭐⭐ AGGIUNGI allRules
            };
        }
        // Altrimenti processa normalmente
        else if (activeRule.daily_schedules && activeRule.daily_schedules.length > 0) {
            try {
                let schedules = activeRule.daily_schedules;
                if (Array.isArray(schedules) && schedules.length > 0 && Array.isArray(schedules[0])) {
                    schedules = schedules.flat();
                }

                specialDays = schedules
                    .map(item => {
                        if (item && typeof item === 'object' && item.day) {
                            console.log("📅 Schedule trovato:", item);
                            return item.day;
                        }
                        return null;
                    })
                    .filter(day => day && CONFIG.DAY_NAMES.includes(day));

                console.log("📅 Giorni disponibili speciali:", specialDays);
            } catch (error) {
                console.error("❌ Errore nel processing daily_schedules:", error);
            }
        }
    }

    console.log(`📊 RISULTATO FINALE: defaultDays =`, defaultDays, "specialDays =", specialDays);

    // ⭐⭐ CORREZIONE CRITICA: Ritorna SEMPRE specialDays vuoto e allRules
    return {
        defaultDays: state.currentService.working_days || [],
        specialDays: [], // ⭐⭐ FORZA specialDays VUOTO - le rules gestiscono per data
        availStart: null,
        availEnd: null,
        allRules: allRules // ⭐⭐ AGGIUNGI allRules
    };
},

    // ⭐ AGGIUNGI QUESTO METODO HELPER (fuori da getAvailabilityRules)
    isRuleEmpty(rule) {
        if (!rule.daily_schedules) return true;

        const schedules = rule.daily_schedules;

        // Caso 1: Array completamente vuoto []
        if (Array.isArray(schedules) && schedules.length === 0) {
            return true;
        }

        // Caso 2: Array di array vuoto [[]]
        if (Array.isArray(schedules) && schedules.length === 1 &&
            Array.isArray(schedules[0]) && schedules[0].length === 0) {
            return true;
        }

        // Caso 3: Array con dati validi
        return false;
    },

isDaySelectable(date, today, dayOfWeekStr, defaultDays, specialDays, availStart, availEnd, allRules) {
    
    const dateIsInFuture = !Utils.isDateInPast(date);
    if (!dateIsInFuture) {
        console.log(`❌ ${Utils.formatDateDDMMYYYY(date)} - Data passata`);
        return false;
    }

    console.log(`🔍🔍🔍 DEBUG COMPLETO per ${Utils.formatDateDDMMYYYY(date)}`);
    console.log(`📅 Data: ${date}, Day: ${dayOfWeekStr}`);
    console.log(`📊 DefaultDays: ${defaultDays}, SpecialDays: ${specialDays}`);
    console.log("📦 AllRules disponibili:", allRules?.map(r => ({id: r.id, start: r.start_date, end: r.end_date, empty: CalendarManager.isRuleEmpty(r)})));

    // ⭐⭐ CONTROLLO PRIORITARIO: Se abbiamo specialDays, usali invece dei defaultDays
    if (specialDays && specialDays.length > 0) {
        console.log(`🎯 Usa specialDays per ${Utils.formatDateDDMMYYYY(date)}:`, specialDays);
        const isAvailableInSpecial = specialDays.includes(dayOfWeekStr);
        console.log(`📅 ${Utils.formatDateDDMMYYYY(date)} (${dayOfWeekStr}) - Disponibile in specialDays: ${isAvailableInSpecial}`);
        return isAvailableInSpecial;
    }

    // ⭐⭐ NUOVA LOGICA: Cerca la rule SPECIFICA per questa data
    if (allRules) {
        const ruleForThisDate = allRules.find(rule => {
            const startDate = rule.start_date ? Utils.normalizeDate(new Date(rule.start_date)) : null;
            const endDate = rule.end_date ? Utils.normalizeDate(new Date(rule.end_date)) : null;
            const checkDate = Utils.normalizeDate(date);

            if (startDate && endDate) {
                return checkDate >= startDate && checkDate <= endDate;
            } else if (startDate) {
                return checkDate >= startDate;
            } else if (endDate) {
                return checkDate <= endDate;
            }
            return true;
        });

        console.log(`🎯 Rule trovata per ${Utils.formatDateDDMMYYYY(date)}:`, ruleForThisDate?.id || "Nessuna");

        // ⭐⭐ SE la rule è VUOTA, disabilita IMMEDIATAMENTE
        if (ruleForThisDate && CalendarManager.isRuleEmpty(ruleForThisDate)) {
            console.log(`🚨🚨🚨 ${Utils.formatDateDDMMYYYY(date)} - Rule ${ruleForThisDate.id} VUOTA - giorno DISABILITATO`);
            return false;
        }

        // ⭐⭐ SE c'è una rule con daily_schedules, usa quelli
        if (ruleForThisDate && ruleForThisDate.daily_schedules && ruleForThisDate.daily_schedules.length > 0) {
            try {
                let schedules = ruleForThisDate.daily_schedules;
                // ⭐⭐ CORREZIONE: Gestisci array di array
                if (Array.isArray(schedules) && schedules.length > 0 && Array.isArray(schedules[0])) {
                    schedules = schedules.flat();
                }

                const ruleSpecialDays = schedules
                    .map(item => {
                        if (item && typeof item === 'object' && item.day) {
                            return item.day;
                        }
                        return null;
                    })
                    .filter(day => day && CONFIG.DAY_NAMES.includes(day));

                console.log(`📅 ${Utils.formatDateDDMMYYYY(date)} - Giorni rule ${ruleForThisDate.id}:`, ruleSpecialDays);
                
                if (ruleSpecialDays.length > 0) {
                    const isAvailable = ruleSpecialDays.includes(dayOfWeekStr);
                    console.log(`📅 ${Utils.formatDateDDMMYYYY(date)} (${dayOfWeekStr}) - Disponibile nella rule ${ruleForThisDate.id}: ${isAvailable}`);
                    return isAvailable;
                } else {
                    console.log(`📅 ${Utils.formatDateDDMMYYYY(date)} - Rule ${ruleForThisDate.id} ha daily_schedules ma nessun giorno valido`);
                }
            } catch (error) {
                console.error("❌ Errore nel processing daily_schedules:", error);
            }
        } else if (ruleForThisDate) {
            console.log(`📅 ${Utils.formatDateDDMMYYYY(date)} - Rule ${ruleForThisDate.id} senza daily_schedules`);
        }
    }

    // ⭐⭐ FALLBACK: Se nessuna rule applicabile, usa i giorni default
    const isAvailable = defaultDays.includes(dayOfWeekStr);
    console.log(`📅 ${Utils.formatDateDDMMYYYY(date)} (${dayOfWeekStr}) - Disponibile nei default: ${isAvailable}`);

    return isAvailable;
},

    // ⭐ METODO HELPER: Trova rule per data
    findRuleForDate(date) {
        const allRules = state.currentService._all_availability_rules;
        if (!allRules) return null;

        console.log(`🔍 DEBUG findRuleForDate: ${Utils.formatDateDDMMYYYY(date)}`);

        const foundRule = allRules.find(rule => {
            const startDate = rule.start_date ? Utils.normalizeDate(new Date(rule.start_date)) : null;
            const endDate = rule.end_date ? Utils.normalizeDate(new Date(rule.end_date)) : null;
            const checkDate = Utils.normalizeDate(date);

            console.log(`   Rule ${rule.id}: ${startDate ? Utils.formatDateDDMMYYYY(startDate) : 'null'} - ${endDate ? Utils.formatDateDDMMYYYY(endDate) : 'null'}`);

            if (startDate && endDate) {
                // ⭐⭐ CORREZIONE: Usa <= per endDate per includere l'ultimo giorno
                const matches = checkDate >= startDate && checkDate <= endDate;
                console.log(`   ${Utils.formatDateDDMMYYYY(checkDate)} >= ${Utils.formatDateDDMMYYYY(startDate)} && ${Utils.formatDateDDMMYYYY(checkDate)} <= ${Utils.formatDateDDMMYYYY(endDate)} = ${matches}`);
                return matches;
            } else if (startDate) {
                return checkDate >= startDate;
            } else if (endDate) {
                return checkDate <= endDate;
            }
            return true;
        });

        console.log(`✅ Rule trovata per ${Utils.formatDateDDMMYYYY(date)}:`, foundRule?.id || "Nessuna");
        return foundRule;
    },

    // ⭐⭐ METODO HELPER: Verifica se una rule è VUOTA (scalabile)
    isRuleEmpty(rule) {
        if (!rule.daily_schedules) return true;

        const schedules = rule.daily_schedules;

        // Caso 1: Array completamente vuoto []
        if (Array.isArray(schedules) && schedules.length === 0) {
            return true;
        }

        // Caso 2: Array di array vuoto [[]]
        if (Array.isArray(schedules) && schedules.length === 1 &&
            Array.isArray(schedules[0]) && schedules[0].length === 0) {
            return true;
        }

        // Caso 3: Array con dati validi
        return false;
    },
createDayElement(day, dayOfWeekStr, date, isSelectable) {
    const dateDiv = document.createElement('div');
    dateDiv.classList.add('div-block-6');
    dateDiv.innerHTML = `
        <div class="text-block-10"><strong>${day}</strong></div>
        <div class="text-block-10">${dayOfWeekStr}</div>
    `;

    // ⭐⭐ CORREZIONE: Aggiungi classe 'disabled' visivamente per giorni non selezionabili
    if (!isSelectable) {
        dateDiv.classList.add('disabled');
        dateDiv.style.opacity = '0.5';
        dateDiv.style.pointerEvents = 'none';
        dateDiv.style.cursor = 'not-allowed';
    } else {
        dateDiv.addEventListener('click', () => this.selectDate(date));
        dateDiv.style.cursor = 'pointer';
    }

    // ⭐⭐ Aggiungi anche stile per giorni selezionati
    if (state.selectedDate && date.getTime() === state.selectedDate.getTime()) {
        dateDiv.classList.add('selected');
        dateDiv.style.color = 'white';
    }

    return dateDiv;
},

    changeMonth(delta) {
        CacheManager.clear();
        state.currentDate.setMonth(state.currentDate.getMonth() + delta);
        this.render();
    },
};


// HOURS MANAGER
const HoursManager = {
    async render() {
        if (!DOM.hoursGrid || !state.currentService || !state.selectedDate) {
            DOM.hoursGrid.innerHTML = '';
            return;
        }

        DOM.hoursGrid.innerHTML = '<p style="text-align: center; width: 100%;">Caricamento orari...</p>';

        try {
            const hours = this.getAvailableHours();

            if (hours.length === 0) {
                DOM.hoursGrid.innerHTML = '<p style="text-align: center; width: 100%;">Nessun orario disponibile per questa data.</p>';
                this.disableNextButton();
                return;
            }

            const slots = await this.loadSlots();

            // Pre-carica le informazioni di occupazione dell'artigiano
            const artisanBusyInfo = await this.preloadArtisanBusyInfo(hours);

            DOM.hoursGrid.innerHTML = '';
            let firstAvailableHour = null;

            for (const hour of hours) {
                const isArtisanBusy = artisanBusyInfo[hour] || false;
                const btn = this.createHourButton(hour, slots, isArtisanBusy);

                if (!btn.disabled && firstAvailableHour === null) {
                    firstAvailableHour = hour;
                }

                DOM.hoursGrid.appendChild(btn);
            }

            if (firstAvailableHour !== null) {
                this.selectHour(firstAvailableHour);
            } else {
                this.disableNextButton();
            }

        } catch (error) {
            console.error('Errore nel caricamento degli orari:', error);
            DOM.hoursGrid.innerHTML = '<p style="text-align: center; width: 100%; color: red;">Errore nel caricare gli slot.</p>';
            this.disableNextButton();
        }
    },
    getAvailableHours() {
        const hours = [];
        const dayOfWeekStr = CONFIG.DAY_NAMES[(state.selectedDate.getDay() + 6) % 7];

        // ⭐ INTERVALLO DINAMICO
        const serviceDurationHours = state.currentService.duration_minutes / 60;
        console.log("🔍 Cerco orari per:", dayOfWeekStr, "Durata servizio:", serviceDurationHours + "h");

        // ⭐⭐ NON COMMENTARE QUESTA PARTE - DEVE CALCOLARE startHour e endHour!
        let startHour, endHour;

        // PRIMA cerca negli orari speciali
        const ruleForDate = CalendarManager.findRuleForDate(state.selectedDate);
        if (ruleForDate?.daily_schedules) {
            console.log("🔍 Cerco orari speciali in daily_schedules");
            try {
                let schedules = ruleForDate.daily_schedules;
                if (Array.isArray(schedules) && schedules.length > 0) {
                    if (Array.isArray(schedules[0])) {
                        schedules = schedules.flat();
                    }
                    const scheduleForDay = schedules.find(s => s && s.day === dayOfWeekStr);
                    if (scheduleForDay) {
                        console.log("✅ Trovato orario speciale:", scheduleForDay);
                        startHour = parseInt(scheduleForDay.start.split(':')[0]);
                        endHour = parseInt(scheduleForDay.end.split(':')[0]);

                        // ⭐ CORREZIONE: Genera con intervallo corretto
                        console.log(`🕒 Orari speciali: ${startHour}:00 - ${endHour}:00, intervallo: ${serviceDurationHours}h`);
                        for (let h = startHour; h < endHour; h += serviceDurationHours) {
                            hours.push(h);
                        }
                        console.log("📅 Ore generate da speciali:", hours);
                        return hours;
                    }
                }
            } catch (error) {
                console.error("❌ Errore nel parsing orari speciali:", error);
            }
        }

        // ALTRIMENTI usa orari default
        console.log("🔍 Uso orari di default del servizio");
        startHour = parseInt(state.currentService.working_hours_start.split(':')[0]);
        endHour = parseInt(state.currentService.working_hours_end.split(':')[0]);

        // ⭐ CORREZIONE: Genera con intervallo corretto
        console.log(`🕒 Orari default: ${startHour}:00 - ${endHour}:00, intervallo: ${serviceDurationHours}h`);
        for (let h = startHour; h < endHour; h += serviceDurationHours) {
            hours.push(h);
        }

        console.log("📅 Ore generate da default:", hours);
        return hours;
    },

    // ⭐⭐ AGGIUNGI ANCHE isRuleEmpty a HoursManager
    isRuleEmpty(rule) {
        if (!rule.daily_schedules) return true;

        const schedules = rule.daily_schedules;

        // Caso 1: Array completamente vuoto []
        if (Array.isArray(schedules) && schedules.length === 0) {
            return true;
        }

        // Caso 2: Array di array vuoto [[]]
        if (Array.isArray(schedules) && schedules.length === 1 &&
            Array.isArray(schedules[0]) && schedules[0].length === 0) {
            return true;
        }

        // Caso 3: Array con dati validi
        return false;
    },

    async preloadArtisanBusyInfo(hours) {
        const busyInfo = {};

        if (!state.currentService?._artisan) {
            return busyInfo;
        }

        const artisanId = state.currentService._artisan.id;

        try {
            console.log(`🎯 DEBUG: Chiamando NUOVO endpoint per artigiano ${artisanId}`);
            const artisanSlots = await this.getAllArtisanSlotsForDate(artisanId, state.selectedDate);
            console.log("📊 Slot occupati artigiano:", artisanSlots);

            // Per ogni ora, verifica se l'artigiano ha QUALSIASI slot occupato
            hours.forEach(hour => {
                const isBusy = this.isArtisanBusyInHour(artisanSlots, hour);
                busyInfo[hour] = isBusy;

                if (isBusy) {
                    console.log(`🚫 Artigiano occupato alle ${hour}:00 (slot occupato)`);
                }
            });

        } catch (error) {
            console.error("❌ Errore nel controllo disponibilità artigiano:", error);
        }

        return busyInfo;
    },

    async getAllArtisanSlotsForDate(artisanId, date) {
        try {
            const dateStr = Utils.formatDateISO(date);
            console.log(`🎯 DEBUG: Chiamando endpoint artisan_bookings?artisan_id=${artisanId}&date=${dateStr}`);

            // 🔥 CORREGGI: Rimuovi /api/ dal path
            const bookings = await API.request(`/artisan_bookings?artisan_id=${artisanId}&date=${dateStr}`);
            console.log("✅ Risposta endpoint:", bookings);

            if (!bookings || !Array.isArray(bookings)) {
                console.error("❌ Risposta non valida:", bookings);
                return [];
            }

            console.log(`🎯 Prenotazioni trovate: ${bookings.length}`);

            const artisanSlots = bookings.map(booking => ({
                id: booking.slot_id,
                start_time: booking.slot_start_time,
                end_time: booking.slot_end_time,
                service_id: booking.service_id,
                _service: {
                    id: booking.service_id,
                    name: booking.service_name,
                    artisan_id: artisanId
                }
            }));

            console.log("📦 Slot elaborati:", artisanSlots);
            return artisanSlots;

        } catch (error) {
            console.error("❌ Errore completo:", error);
            return [];
        }
    },

    isArtisanBusyInHour(artisanSlots, hour) {
        // ⭐ NUOVA VERSIONE - con controllo intervalli
        const serviceDurationHours = state.currentService.duration_minutes / 60;
        const currentSlotEndHour = hour + serviceDurationHours;

        console.log(`🔍 Verifica ${artisanSlots.length} slot per ${hour}:00-${currentSlotEndHour}:00`);

        // DEBUG: Mostra tutti gli slot
        artisanSlots.forEach(slot => {
            const startTimestamp = slot.start_time > 10000000000 ? slot.start_time : slot.start_time * 1000;
            const endTimestamp = slot.end_time > 10000000000 ? slot.end_time : slot.end_time * 1000;
            const slotStartHour = new Date(startTimestamp).getHours();
            const slotEndHour = new Date(endTimestamp).getHours();
            console.log(`⏰ Slot ${slot.id}: ${slotStartHour}:00-${slotEndHour}:00`);
        });

        const hasConflict = artisanSlots.some(slot => {
            if (!slot.start_time || !slot.end_time) return false;

            const startTimestamp = slot.start_time > 10000000000 ? slot.start_time : slot.start_time * 1000;
            const endTimestamp = slot.end_time > 10000000000 ? slot.end_time : slot.end_time * 1000;
            const slotStartHour = new Date(startTimestamp).getHours();
            const slotEndHour = new Date(endTimestamp).getHours();

            // ⭐ CONTROLLO INTERVALLI: [hour, currentSlotEndHour] vs [slotStartHour, slotEndHour]
            const overlaps = (hour < slotEndHour && currentSlotEndHour > slotStartHour);

            if (overlaps) {
                console.log(`🚫 CONFLITTO: ${hour}:00-${currentSlotEndHour}:00 con slot ${slot.id} (${slotStartHour}:00-${slotEndHour}:00)`);
            }

            return overlaps;
        });

        console.log(`📋 Risultato finale ${hour}:00-${currentSlotEndHour}:00: ${hasConflict ? 'OCCUPATO' : 'libero'}`);
        return hasConflict;
    },

    async loadSlots() {
        const cached = CacheManager.get(state.currentService.id, state.selectedDate);
        if (cached) {
            return cached;
        }

        const slots = await API.getSlots(state.currentService.id, state.selectedDate);
        CacheManager.set(state.currentService.id, state.selectedDate, slots);
        return slots;
    },

    createHourButton(hour, slots, isArtisanBusy = false) {
        const btn = document.createElement('button');
        const serviceDurationHours = state.currentService.duration_minutes / 60;
        const endHour = hour + serviceDurationHours;
        btn.classList.add('button-3', 'w-button');
        btn.setAttribute('type', 'button');

        const slot = this.findSlotForHour(slots, hour);
        const availableSpots = slot ? (slot.capacity - slot.booked_count) : state.currentService.max_capacity_per_slot;

        // 🔥 PRIORITÀ ASSOLUTA: Artigiano occupato
        const isFull = isArtisanBusy || availableSpots <= 0;

        let statusText, statusTitle, buttonStyle = '';

        if (isArtisanBusy) {
            statusText = 'Artigiano occupato';
            statusTitle = 'L\'artigiano ha già altri workshop in questo orario';
            buttonStyle = 'style="background-color: #fef2f2; color: #dc2626; border-color: #fca5a5; opacity: 0.7;"';
        } else if (availableSpots <= 0) {
            statusText = 'Posti esauriti';
            statusTitle = 'Tutti i posti per questo orario sono occupati';
            buttonStyle = 'style="opacity: 0.5;"';
        } else {
            statusText = `${availableSpots} posti liberi`;
            statusTitle = '';
        }

        btn.innerHTML = `
        <div style="font-size: 16px; font-weight: bold;">
            ${hour}:00 - ${endHour}:00
        </div>
        <div style="font-size: 12px; margin-top: 4px;">${statusText}</div>
    `;

        if (buttonStyle) {
            btn.setAttribute('style', buttonStyle.replace(/style="|"/g, ''));
        }

        if (isFull) {
            btn.disabled = true;
            btn.classList.add('disabled');
            btn.title = statusTitle;
        } else {
            btn.addEventListener('click', () => {
                this.selectHour(hour);
                PricingManager.update();
                this.updateNumberInputLimit(availableSpots);
            });
        }

        return btn;
    },

    findSlotForHour(slots, hour) {
        const startTime = Utils.createTimestamp(state.selectedDate, hour) / 1000;
        return slots.find(s => s.start_time == startTime) || null;
    },

    selectHour(hour) {
        state.selectedHour = hour;
        const hourButtons = DOM.hoursGrid.querySelectorAll('.button-3');
        hourButtons.forEach(btn => {
            btn.classList.remove('selected');
            if (btn.querySelector('div')?.textContent.startsWith(`${hour}:`)) {
                btn.classList.add('selected');
            }
        });

        DOM.nextBtn.disabled = false;
        DOM.nextBtn.classList.remove('disabled');
    },

    disableNextButton() {
        state.selectedHour = null;
        DOM.nextBtn.disabled = true;
        DOM.nextBtn.classList.add('disabled');
    },

    updateNumberInputLimit(maxAvailableSpots) {
        if (!DOM.numInput) return;

        const serviceMaxCapacity = state.currentService.max_capacity_per_slot;
        const actualMax = Math.min(maxAvailableSpots, serviceMaxCapacity);
        const currentValue = parseInt(DOM.numInput.value) || 1;

        DOM.numInput.setAttribute('max', actualMax);
        DOM.numInput.setAttribute('title', `Massimo ${actualMax} persone per questo orario`);

        if (currentValue > actualMax) {
            DOM.numInput.value = actualMax;
            Utils.showInfo(`Numero persone aggiornato a ${actualMax} (posti disponibili)`);
        }
        PricingManager.update();
    },

    async getAllArtisanBookingsForDate(artisanId, date) {
        const cached = CacheManager.getArtisanBookings(artisanId, date);
        if (cached) return cached;

        console.log(`📡 Caricamento TUTTE le prenotazioni artigiano ${artisanId} per ${Utils.formatDateISO(date)}`);

        try {
            // 🔥 MODIFICA: Carica TUTTE le prenotazioni senza filtri per servizio
            const allBookings = await API.getAllBookings();
            const dateStr = Utils.formatDateISO(date);

            console.log("📊 Totale prenotazioni caricate:", allBookings.length);

            // 🔥 MODIFICA: Filtra per data E per artigiano (tramite service relation)
            const artisanBookings = allBookings.filter(booking => {
                if (!booking || !booking.date) return false;

                // 1. Verifica corrispondenza data
                let bookingDateStr;
                if (typeof booking.date === 'string') {
                    bookingDateStr = booking.date;
                } else {
                    bookingDateStr = Utils.formatDateISO(new Date(booking.date));
                }

                const dateMatches = bookingDateStr === dateStr;
                if (!dateMatches) return false;

                // 2. Verifica che la prenotazione appartenga all'artigiano
                // (assumendo che booking.service_id corrisponda a un servizio dell'artigiano)
                if (state.currentService?._artisan?._service_of_artisan_2) {
                    const artisanServices = state.currentService._artisan._service_of_artisan_2;
                    const belongsToArtisan = artisanServices.some(service => service.id === booking.service_id);

                    if (belongsToArtisan) {
                        console.log(`✅ Prenotazione artigiano trovata:`, {
                            service: booking.service_id,
                            hour: booking.selected_hour,
                            booking: booking
                        });
                    }

                    return belongsToArtisan;
                }

                return false;
            });

            console.log(`📅 Prenotazioni artigiano per ${dateStr}: ${artisanBookings.length}`, artisanBookings);

            // Salva in cache
            CacheManager.setArtisanBookings(artisanId, date, artisanBookings);

            return artisanBookings;

        } catch (error) {
            console.error("❌ Errore nel caricamento prenotazioni artigiano:", error);
            return [];
        }
    },




    checkConflictsFromCache(dailyBookings, otherServices, hour) {
        console.log(`🔍 Check conflitti per ora ${hour}:00`);
        console.log(`📊 Daily bookings da analizzare:`, dailyBookings);

        for (const service of otherServices) {
            console.log(`\n🔍 Verifico servizio: ${service.name} (ID: ${service.id})`);

            // USA slot_id invece di service_id
            const serviceBookings = dailyBookings.filter(booking => {
                return booking.slot_id === service.id;
            });

            console.log(`📋 Prenotazioni per ${service.name}:`, serviceBookings.length, serviceBookings);

            const hasBooking = serviceBookings.some(booking => {
                console.log(`\n📖 Analizzo booking:`, booking);

                // USA time (IN MILLISECONDI) invece di selected_hour
                let bookingHour;
                if (booking.time) {
                    // I tuoi timestamp sono in MILLISECONDI (1765533600000)
                    bookingHour = new Date(booking.time).getHours();
                    console.log(`⏱️ time → Ora: ${booking.time} → ${bookingHour}:00`);
                } else {
                    console.log(`❌ time mancante nel booking`);
                    bookingHour = null;
                }

                const hourMatches = bookingHour === hour;
                console.log(`✅ Ora corrisponde? ${bookingHour} === ${hour} → ${hourMatches}`);

                return hourMatches;
            });

            if (hasBooking) {
                console.log(`🚫 CONFLITTO TROVATO: ${service.name} alle ${hour}:00`);
                return true;
            } else {
                console.log(`✅ Nessun conflitto per ${service.name} alle ${hour}:00`);
            }
        }

        console.log(`🔍 Nessun conflitto trovato per le ${hour}:00`);
        return false;
    },
};

// EXTRAS MANAGER
const ExtrasManager = {
    render() {
        if (!DOM.extrasContainer || !DOM.extrasTitle) return;

        const extras = state.currentService._extra_of_service;

        if (extras?.length > 0) {
            const extra = extras[0];
            DOM.extrasContainer.style.display = "flex";
            DOM.extrasTitle.style.display = "block";

            const checkbox = DOM.extrasContainer.querySelector("input[type='checkbox']");
            if (checkbox) checkbox.checked = false;

            const nameSpan = DOM.extrasContainer.querySelector(".checkbox-label-2");
            if (nameSpan) nameSpan.textContent = extra.name;

            const priceDiv = DOM.extrasContainer.querySelector(".text-block-11");
            if (priceDiv) {
                priceDiv.innerHTML = `<strong> (+</strong>${extra.price}<strong>€)</strong>`;
            }
        } else {
            DOM.extrasContainer.style.display = "none";
            DOM.extrasTitle.style.display = "none";
        }
    }
};


// PRICING MANAGER
const PricingManager = {
    update() {
        if (!state.currentService) return;

        const numPeople = Math.max(1, parseInt(DOM.numInput.value) || 1);
        const availableSpots = this.getActualAvailableSpots();
        const { basePrice, extraCost, totalPrice } = this.calculatePricing(numPeople);

        this.updatePeopleText(numPeople, basePrice);
        this.updateExtraRecap(extraCost);
        this.updateTotalPrice(numPeople, basePrice, totalPrice);
        this.updateCapacityNotice(numPeople, availableSpots);
        this.updateNextButtonState(numPeople, availableSpots);
        this.updateInputMaxLimit(availableSpots);
    },

    findSelectedSlot() {
        if (!state.currentService || !state.selectedDate || state.selectedHour === null) {
            return null;
        }

        try {
            const cacheKey = CacheManager.generateKey(state.currentService.id, state.selectedDate);
            const cachedSlots = state.slotsCache.get(cacheKey);

            if (cachedSlots && cachedSlots.data) {
                const startTime = Utils.createTimestamp(state.selectedDate, state.selectedHour);
                const slot = cachedSlots.data.find(s => s.start_time === startTime);
                return slot || null;
            }

            return null;

        } catch (error) {
            console.error("Errore nel trovare lo slot selezionato:", error);
            return null;
        }
    },

    getActualAvailableSpots() {
        if (!state.currentService) {
            return state.currentService?.max_capacity_per_slot || 8;
        }

        const slot = this.findSelectedSlot();

        if (slot) {

            const available = slot.capacity - (slot.booked_count || 0);
            return available;
        }

        return state.currentService.max_capacity_per_slot;
    },


    updateInputMaxLimit(availableSpots) {
        if (DOM.numInput) {
            const serviceMax = state.currentService.max_capacity_per_slot;
            const actualMax = Math.min(availableSpots, serviceMax);

            DOM.numInput.setAttribute('max', actualMax);
            DOM.numInput.setAttribute('title', `Massimo ${actualMax} persone per questo orario`);

            const currentValue = parseInt(DOM.numInput.value) || 1;
            if (currentValue > actualMax) {
                DOM.numInput.value = actualMax;
                Utils.showInfo(`Numero persone aggiornato a ${actualMax} (posti disponibili)`);
            }
        }
    },

    updateNextButtonState(numPeople, maxAllowed) {
        const isOverCapacity = numPeople > maxAllowed;

        if (DOM.nextBtn) {
            DOM.nextBtn.disabled = isOverCapacity;
            DOM.nextBtn.classList.toggle('disabled', isOverCapacity);

            if (isOverCapacity) {
                DOM.nextBtn.title = `Massimo ${maxAllowed} persone per questo orario`;
            } else {
                DOM.nextBtn.title = "";
            }
        }
    },

    updateCapacityNotice(numPeople, maxAllowed) {
        let notice = document.querySelector(".max-capacity-notice");

        if (!notice) {
            notice = document.createElement("div");
            notice.classList.add("max-capacity-notice");
            if (DOM.numInput?.parentNode) {
                DOM.numInput.insertAdjacentElement('afterend', notice);
            }
        }

        const availableSpots = maxAllowed - numPeople;
        notice.style.cssText = "color: #666; font-size: 14px; margin-top: 0.5rem;";

        if (availableSpots === 0) {
            notice.textContent = ` Tutti i ${maxAllowed} posti sono stati prenotati`;
            notice.style.color = "#f59e0b";
            notice.style.fontWeight = "bold";
        } else {
            notice.textContent = `${availableSpots} posti disponibili su ${maxAllowed}`;
            notice.style.color = "#22c55e";
        }
    },
    calculatePricing(numPeople) {
        let basePrice = state.currentService.base_price;


        if (state.currentService._service_prices?.length > 0) {
            const matched = state.currentService._service_prices.find(p =>
                numPeople >= p.min_people && numPeople <= p.max_people
            );
            if (matched) basePrice = matched.price;
        }

        const costPerPersonWithFee = basePrice * (1 + state.currentService.platform_fee_percent / 100);

        let extraCost = 0;
        const checkbox = DOM.extrasContainer?.querySelector("input[type='checkbox']");
        if (checkbox?.checked && state.currentService._extra_of_service?.length > 0) {
            const extra = state.currentService._extra_of_service[0];
            extraCost = extra.per_person ? extra.price * numPeople : extra.price;
        }

        const totalPrice = costPerPersonWithFee * numPeople + extraCost;

        return { basePrice: costPerPersonWithFee, extraCost, totalPrice };
    },

    updatePeopleText(numPeople, costPerPerson) {
        const personLabel = numPeople === 1 ? "persona" : "persone";

        if (DOM.peopleText) {
            DOM.peopleText.textContent = `${numPeople} ${personLabel} × ${costPerPerson.toFixed(2)}€ a testa`;
        }

        if (DOM.totalText) {
            DOM.totalText.textContent = `${numPeople} × ${costPerPerson.toFixed(2)}€`;
        }
    },

    updateExtraRecap(extraCost) {
        const extraRecap = document.querySelector(".recap-step2.extra-hidden.extra-lable");
        if (!extraRecap) return;

        if (extraCost > 0) {
            extraRecap.style.display = "flex";
            const priceSpan = extraRecap.querySelector(".w-embed:nth-child(2) .my-span-class");
            if (priceSpan) {
                priceSpan.textContent = `${extraCost.toFixed(2)}€`;
            }
        } else {
            extraRecap.style.display = "none";
        }
    },

    updateTotalPrice(numPeople, costPerPerson, totalPrice) {
        if (DOM.totalPrice) {
            DOM.totalPrice.textContent = `${totalPrice.toFixed(2)}€`;
        }
    }
};

// RECAP MANAGER

const RecapManager = {
    update() {
        const recapStep = DOM.steps[DOM.steps.length - 1];

        if (!recapStep || !state.currentService) return;
        this.updateUserInfo(recapStep);
        this.updateBookingInfo(recapStep);
        this.updateExtraInfo(recapStep);
        this.updateTotalPrice(recapStep);
    },

    updateUserInfo(recapStep) {
        const fields = [
            { selector: '.name', input: DOM.nameInput },
            { selector: '.email', input: DOM.emailInput },
            { selector: '.phone', input: DOM.phoneInput, defaultValue: '-' }
        ];

        fields.forEach(({ selector, input, defaultValue }) => {
            const element = recapStep.querySelector(selector);
            if (element && input) {
                element.textContent = input.value || defaultValue || '';
            }
        });
    },

    updateBookingInfo(recapStep) {

        const serviceNameEl = recapStep.querySelector(".nome-servizio");
        if (serviceNameEl) {
            serviceNameEl.textContent = state.currentService.name;
        }


        const dateTimeEl = recapStep.querySelector(".data-ora");
        if (dateTimeEl && state.selectedDate && state.selectedHour !== null) {
            const formattedDate = Utils.formatDateDDMMYYYY(state.selectedDate);
            dateTimeEl.textContent = `${formattedDate} alle ore ${state.selectedHour}:00`;
        }


        const guestsEl = recapStep.querySelector(".numero-ospiti");
        if (guestsEl && DOM.numInput) {
            const numPeople = parseInt(DOM.numInput.value) || 1;
            const label = numPeople === 1 ? "ospite" : "ospiti";
            guestsEl.textContent = `${numPeople} ${label}`;
        }
    },

    updateExtraInfo(recapStep) {
        const extraContainer = recapStep.querySelector(".extra-container");
        if (!extraContainer) return;

        const checkbox = DOM.extrasContainer?.querySelector("input[type='checkbox']");
        const extras = state.currentService._extra_of_service;

        if (checkbox?.checked && extras?.length > 0) {
            extraContainer.style.display = "flex";
            const extra = extras[0];

            const extraNameEl = extraContainer.querySelector(".checkbox-label-2");
            if (extraNameEl) {
                extraNameEl.textContent = extra.name;
            }
        } else {
            extraContainer.style.display = "none";
        }
    },

    updateTotalPrice(recapStep) {
        const totalPriceEl = recapStep.querySelector(".total-price");
        if (!totalPriceEl) return;

        const numPeople = Math.max(1, parseInt(DOM.numInput.value) || 1);
        const { totalPrice } = PricingManager.calculatePricing(numPeople);

        totalPriceEl.textContent = `${totalPrice.toFixed(2)}€`;
    }
};

// OPTIMIZED BOOKING MANAGER
const BookingManager = {
    async submit() {

        if (!this.validateBooking()) {
            return;
        }


        DOM.nextBtn.disabled = true;
        DOM.nextBtn.textContent = "Elaborazione...";

        try {
            console.log("📤 Inizio processo di prenotazione ottimizzato...");
            const bookingData = this.prepareBookingData();
            const response = await this.makeCompleteBookingCall(bookingData);

            await this.processPayment(
                bookingData.user_email,
                Math.round(bookingData.total_price * 100),
                response.booking_id
            );

        } catch (error) {
            console.error("❌ Errore durante la prenotazione:", error);
            Utils.showError(`Errore: ${error.message}`);
            DOM.nextBtn.disabled = false;
            DOM.nextBtn.textContent = "Prenota e paga";
        }
    },

    prepareBookingData() {
        const numPeople = parseInt(DOM.numInput.value) || 1;
        const { totalPrice, extraId } = this.calculateFinalPrice(numPeople);
        const timestamp = Utils.createTimestamp(state.selectedDate, state.selectedHour);

        return {
            user_name: DOM.nameInput.value.trim(),
            user_email: DOM.emailInput.value.trim(),
            user_phone: (DOM.phoneInput?.value.trim()) || "",
            service_id: state.currentService.id,
            selected_date: Utils.formatDateISO(state.selectedDate),
            selected_hour: timestamp,
            num_people: numPeople,
            booking_extra_id: extraId || 0,
            total_price: totalPrice
        };
    },

    async makeCompleteBookingCall(bookingData) {
        console.log("🚀 Invio dati prenotazione completi:", bookingData);

        const response = await API.request('/api/complete_booking', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });

        console.log("✅ Risposta API completa:", response);

        if (!response) {
            throw new Error("Risposta API non valida");
        }

        if (!response.booking_id) {
            console.warn("⚠️ booking_id non presente nella risposta, provo a recuperarlo...");

            const bookingId = await this.getLastBookingIdFallback(bookingData.user_email);
            return { ...response, booking_id: bookingId };
        }

        console.log("✅ ID Prenotazione ottenuto direttamente:", response.booking_id);
        return response;
    },

    async getLastBookingIdFallback(userEmail) {
        try {
            const bookings = await API.request(`/booking?user_email=${encodeURIComponent(userEmail)}`);

            if (bookings && bookings.length > 0) {
                const lastBooking = bookings.reduce((latest, booking) => {
                    return (!latest || booking.created_at > latest.created_at) ? booking : latest;
                }, null);

                return lastBooking.id;
            }

            throw new Error("Nessuna prenotazione trovata");
        } catch (error) {
            console.error("Errore nel recupero ID prenotazione:", error);
            throw new Error("Prenotazione creata ma impossibile ottenere l'ID per il pagamento");
        }
    },

    validateBooking() {
        if (!DOM.nameInput.value || !DOM.emailInput.value) {
            Utils.showError("Per favore compila i campi obbligatori: Nome e Email");
            return false;
        }

        if (!Utils.isValidEmail(DOM.emailInput.value)) {
            Utils.showError("Inserisci un indirizzo email valido");
            return false;
        }

        if (!DOM.gdprCheckbox.checked) {
            Utils.showError("Devi accettare il trattamento dei dati personali per procedere");
            return false;
        }

        if (!state.selectedDate || state.selectedHour === null) {
            Utils.showError("Per favore seleziona data e orario");
            return false;
        }

        if (!state.currentService) {
            Utils.showError("Servizio non caricato correttamente");
            return false;
        }

        return true;
    },

    calculateFinalPrice(numPeople) {
        const { totalPrice } = PricingManager.calculatePricing(numPeople);

        let extraId = 0;
        const checkbox = DOM.extrasContainer?.querySelector("input[type='checkbox']");
        if (checkbox?.checked && state.currentService._extra_of_service?.length > 0) {
            extraId = state.currentService._extra_of_service[0].id;
        }

        return { totalPrice, extraId };
    },

    async processPayment(userEmail, totalAmountInCents, bookingId) {
        console.log("💳 Creazione sessione Stripe...");
        console.log("📊 Dati inviati:", {
            email: userEmail,
            total_amount: totalAmountInCents,
            booking_id: bookingId
        });

        try {
            const stripeData = await API.createStripeCheckout(
                userEmail,
                totalAmountInCents,
                bookingId
            );

            console.log("✅ Risposta Stripe ricevuta:", stripeData);

            if (stripeData.redirect_url) {
                console.log("🔄 Reindirizzamento a Stripe:", stripeData.redirect_url);
                window.location.href = stripeData.redirect_url;
            } else {
                console.error("❌ Risposta completa Stripe:", JSON.stringify(stripeData, null, 2));
                throw new Error("URL di redirect Stripe non ricevuto");
            }
        } catch (error) {
            console.error("❌ Errore nel processo di pagamento:", error);

            if (error.message.includes('Unable to locate var')) {
                throw new Error(
                    'Configurazione pagamento non completata. ' +
                    'La prenotazione è stata salvata (ID: ' + bookingId + '). ' +
                    'Contatta il supporto per completare il pagamento.'
                );
            }
            throw error;
        }
    }
};

// SERVICE LOADER
const ServiceLoader = {
    async load(serviceSlug) {
        try {
            console.log(`🔄 Caricamento servizio: ${serviceSlug}`);
            state.currentService = await API.getServiceBySlug(serviceSlug);
            console.log("✅ Servizio caricato:", state.currentService);

            // DEBUG: Verifica il nuovo addon - CORREGGI IL NOME DELLA PROPRIETÀ
            if (state.currentService._artisan) {
                console.log("👨‍🔧 Artigiano:", state.currentService._artisan);
                console.log("📦 Servizi artigiano (_service_of_artisan_2):", state.currentService._artisan._service_of_artisan_2); // ⬅️ CORRETTO

                if (state.currentService._artisan._service_of_artisan_2) { // ⬅️ CORRETTO
                    const otherServices = state.currentService._artisan._service_of_artisan_2 // ⬅️ CORRETTO
                        .filter(s => s.id !== state.currentService.id);
                    console.log(`🔍 ${otherServices.length} altri servizi dell'artigiano:`, otherServices.map(s => `${s.name} (ID: ${s.id})`));
                } else {
                    console.log("❌ _service_of_artisan_2 non trovato, chiavi disponibili:", Object.keys(state.currentService._artisan));
                }
            }

            state.selectedDate = null;
            state.selectedHour = null;
            state.currentDate = new Date();

            CalendarManager.render();
            ExtrasManager.render();
            PricingManager.update();
            StepNavigation.goToStep(1);

        } catch (error) {
            console.error("❌ Errore nel caricamento del servizio:", error);
            Utils.showError("Impossibile caricare il servizio. Riprova.");
        }
    }
};


// EVENT LISTENERS

function initializeEventListeners() {
    [DOM.nextBtn, DOM.backBtn].forEach(btn => {
        btn?.setAttribute("type", "button");
    });

    DOM.nextBtn?.addEventListener("click", () => {
        if (DOM.nextBtn.disabled) return;
        StepNavigation.next();
    });

    DOM.backBtn?.addEventListener("click", () => {
        if (DOM.backBtn.disabled) return;
        StepNavigation.back();
    });

    let calendarInitialized = false;

    DOM.prevMonthBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        CalendarManager.changeMonth(-1);
    });

    DOM.nextMonthBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        CalendarManager.changeMonth(1);
    });

    // CORREZIONE: Gestione semplificata dei service buttons
    document.querySelectorAll('[data-service-slug]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const serviceSlug = btn.dataset.serviceSlug;
            console.log(`🎯 Click su servizio: ${serviceSlug}`);

            if (!state.currentService || state.currentService.slug !== serviceSlug) {
                await ServiceLoader.load(serviceSlug);
            }

            Modal.open();
        });
    });

    if (!calendarInitialized) {
        calendarInitialized = true;
        console.log("📅 Calendario inizializzato");
    }

    const debouncedUpdate = Utils.debounce(() => PricingManager.update(), 300);
    DOM.numInput?.addEventListener('input', debouncedUpdate);

    const checkbox = DOM.extrasContainer?.querySelector("input[type='checkbox']");
    checkbox?.addEventListener('change', () => PricingManager.update());

    DOM.gdprCheckbox?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            DOM.gdprCheckbox.checked = !DOM.gdprCheckbox.checked;
            DOM.gdprCheckbox.dispatchEvent(new Event('change'));
        }
    });

    DOM.closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => Modal.close());
    });

    DOM.modalOverlay?.addEventListener('click', (e) => {
        if (e.target === DOM.modalOverlay) {
            Modal.close();
        }
    });
}

const AccessibilityManager = {
    init() {
        this.setupKeyboardNavigation();
        this.setupFocusManagement();
        this.setupAriaLabels();
    },

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (!DOM.modalContainer || DOM.modalContainer.style.display === 'none') return;

            switch (e.key) {
                case 'Escape':
                    Modal.close();
                    break;

                case 'ArrowRight':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        StepNavigation.next();
                    }
                    break;

                case 'ArrowLeft':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        StepNavigation.back();
                    }
                    break;

                case 'Tab':
                    this.handleTabNavigation(e);
                    break;
            }
        });

        DOM.hoursGrid?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('button-3')) {
                e.target.click();
            }
        });

        DOM.calendarGrid?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('div-block-6') &&
                !e.target.classList.contains('disabled')) {
                e.target.click();
            }
        });
    },

    handleTabNavigation(e) {
        const focusableElements = this.getFocusableElements();
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
        }
    },

    getFocusableElements() {
        const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        return DOM.bookingModal?.querySelectorAll(selector) || [];
    },

    setupFocusManagement() {
        const originalOpen = Modal.open;
        Modal.open = function () {
            originalOpen();
            setTimeout(() => {
                const firstFocusable = AccessibilityManager.getFocusableElements()[0];
                firstFocusable?.focus();
            }, 100);
        };

        const originalGoToStep = StepNavigation.goToStep;
        StepNavigation.goToStep = function (step) {
            originalGoToStep(step);
            setTimeout(() => {
                const currentStep = DOM.steps[step - 1];
                const firstFocusable = currentStep?.querySelector(
                    'button, input, [tabindex]:not([tabindex="-1"])'
                );
                firstFocusable?.focus();
            }, 50);
        };
    },

    setupAriaLabels() {
        if (DOM.bookingModal) {
            DOM.bookingModal.setAttribute('role', 'dialog');
            DOM.bookingModal.setAttribute('aria-labelledby', 'modal-title');
            DOM.bookingModal.setAttribute('aria-modal', 'true');
        }

        if (!document.getElementById('modal-title')) {
            const title = document.createElement('h1');
            title.id = 'modal-title';
            title.style.cssText = 'position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;';
            title.textContent = 'Prenotazione servizio';
            DOM.bookingModal?.prepend(title);
        }

        DOM.indicators?.forEach((indicator, index) => {
            indicator.setAttribute('aria-label', `Step ${index + 1}`);
        });
    }
};


// INITIALIZATION

function initialize() {
    console.log("🚀 Inizializzazione Booking System...");

    initializeEventListeners();

    AccessibilityManager.init();

    const defaultSlug = document.querySelector('[data-service-slug]')?.dataset.serviceSlug;
    if (defaultSlug) {
        ServiceLoader.load(defaultSlug);
    }

    console.log("✅ Booking System pronto");
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}


// EXPORT 

window.BookingSystem = {
    state,
    API,
    Modal,
    CalendarManager,
    HoursManager,
    BookingManager,
    ServiceLoader,
    Utils
};