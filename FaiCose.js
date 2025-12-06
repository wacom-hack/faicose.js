

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

    // ✅ FUNZIONE AGGIUNTA CORRETTAMENTE
    formatCurrency(amountInCents) {
        if (amountInCents === undefined || amountInCents === null) return '€ 0,00';
        const amount = amountInCents / 100;
        return new Intl.NumberFormat('it-IT', { 
            style: 'currency', 
            currency: 'EUR' 
        }).format(amount);
    },

    formatDateDDMMYYYY(date) {
        if (!date) return "";
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
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

    // Normalizzazione data (Versione robusta)
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
            // Controllo validità cache (1 ora)
            if (Date.now() - data._cached < 3600000) {
                console.log('✅ Servizio caricato dalla CACHE');
                
                // 🔥 FIX CRITICO: Assicuriamoci che _all_availability_rules esista anche nella cache
                // Se la cache è vecchia o corrotta e manca questo campo, invalidiamola
                if (data.service._all_availability_rules) {
                    return data.service;
                } else {
                    console.warn("⚠️ Cache trovata ma incompleta (mancano regole). Ricarico da API.");
                }
            }
        }

        console.log("📡 Scarico servizio da API...");
        const service = await this.request(`/services/slug/${slug}`);

        // Recupero dati Artigiano e Regole
        if (service.artisan_id) {
            try {
                const artisan = await this.request(`/artisan/${service.artisan_id}`);
                service._artisan = artisan;
                
                console.log("👨‍🔧 Artigiano scaricato:", artisan.name);

                // Popolazione Regole Disponibilità
                if (artisan._artisan_availability_rules_of_artisan?.length > 0) {
                    console.log(`✅ Trovate ${artisan._artisan_availability_rules_of_artisan.length} regole di disponibilità.`);
                    service._all_availability_rules = artisan._artisan_availability_rules_of_artisan;
                } else {
                    console.log("❌ Nessuna regola trovata per l'artigiano.");
                    service._all_availability_rules = [];
                }

            } catch (error) {
                console.error("❌ Errore nel caricamento artigiano:", error);
                service._all_availability_rules = [];
            }
        }

        // Salvataggio in Cache (ORA include _all_availability_rules perché l'abbiamo appena aggiunto)
        try {
            sessionStorage.setItem(cacheKey, JSON.stringify({
                service,
                _cached: Date.now()
            }));
        } catch (e) {
            console.warn("Impossibile salvare in cache (quota superata?)", e);
        }

        return service;
    },


    async getSlots(serviceId, date) {
        const dateStr = Utils.formatDateISO(date);
        return await this.request(`/slot?service_id=${serviceId}&date=${dateStr}`);
    },

    async createBooking(bookingData) {
        return await this.request('/api/complete_booking', {
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
  open: function() {
    // Salva la posizione corrente dello scroll
    const scrollY = window.scrollY || window.pageYOffset;
    document.body.dataset.scrollY = scrollY;

    // Blocca lo scroll della pagina sottostante
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.width = "100%";

    // Evita scroll accidentale del body su mobile
    const preventBodyScroll = (e) => {
      if (!DOM.bookingModal.contains(e.target)) {
        e.preventDefault();
      }
    };
    document.body.addEventListener("touchmove", preventBodyScroll, { passive: false });

    // Mostra il modal
    DOM.modalContainer.style.display = "flex";
    DOM.modalOverlay.style.display = "flex";
    DOM.bookingModal.style.display = "block";

    // Gestione input: evita che il focus scrolli il body
    const inputs = DOM.bookingModal.querySelectorAll("input, select, textarea");
    inputs.forEach((input) => {
      input.addEventListener("focus", () => {
        // Non fare nulla, il body è già bloccato
      });
      input.addEventListener("blur", () => {
        // Non fare nulla
      });
    });

    // Salva la funzione per poterla rimuovere al close
    this._preventBodyScroll = preventBodyScroll;
  },

  close: function() {
    // Ripristina lo scroll della pagina
    const scrollY = document.body.dataset.scrollY || 0;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.width = "";
    window.scrollTo(0, scrollY);

    // Rimuove il listener
    document.body.removeEventListener("touchmove", this._preventBodyScroll);

    // Nasconde il modal
    DOM.modalContainer.style.display = "none";
    DOM.modalOverlay.style.display = "none";
    DOM.bookingModal.style.display = "none";
  },
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

        // ⭐⭐ CONTROLLO PRIORITARIO: Giorni di preavviso
        const minNoticeDays = state.currentService?.min_notice_days || 0;
        if (minNoticeDays > 0) {
            const minBookingDate = new Date();
            minBookingDate.setDate(minBookingDate.getDate() + minNoticeDays);
            minBookingDate.setHours(0, 0, 0, 0);

            if (date < minBookingDate) {
                console.log(`⏰ ${Utils.formatDateDDMMYYYY(date)} - Non rispetta preavviso di ${minNoticeDays} giorni`);
                return false;
            }
        }

        console.log(`🔍🔍🔍 DEBUG COMPLETO per ${Utils.formatDateDDMMYYYY(date)}`);
        console.log(`📅 Data: ${date}, Day: ${dayOfWeekStr}`);
        console.log(`📊 DefaultDays: ${defaultDays}, SpecialDays: ${specialDays}`);
        console.log("📦 AllRules disponibili:", allRules?.map(r => ({ id: r.id, start: r.start_date, end: r.end_date, empty: CalendarManager.isRuleEmpty(r) })));

        // ⭐⭐ CERCA rule per questa data (se esiste)
        const ruleForThisDate = allRules?.find(rule => {
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

        // ⭐⭐ SE C'È UNA RULE PER QUESTA DATA, applica le sue regole
        if (ruleForThisDate) {
            // ⭐⭐ SE la rule è VUOTA, disabilita
            if (CalendarManager.isRuleEmpty(ruleForThisDate)) {
                console.log(`🚨🚨🚨 ${Utils.formatDateDDMMYYYY(date)} - Rule ${ruleForThisDate.id} VUOTA - giorno DISABILITATO`);
                return false;
            }

            // ⭐⭐ SE la rule ha daily_schedules, usa quelli
            if (ruleForThisDate.daily_schedules && ruleForThisDate.daily_schedules.length > 0) {
                try {
                    let schedules = ruleForThisDate.daily_schedules;
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
                        return false;
                    }
                } catch (error) {
                    console.error("❌ Errore nel processing daily_schedules:", error);
                    return false;
                }
            }

            // ⭐⭐ SE la rule esiste ma non ha daily_schedules, usa i default
            const isAvailable = defaultDays.includes(dayOfWeekStr);
            console.log(`📅 ${Utils.formatDateDDMMYYYY(date)} (${dayOfWeekStr}) - Rule ${ruleForThisDate.id} senza schedules, usa default: ${isAvailable}`);
            return isAvailable;
        }

        // ⭐⭐ SE NON C'È NESSUNA RULE: usa i giorni default (selezionabile)
        const isAvailable = defaultDays.includes(dayOfWeekStr);
        console.log(`📅 ${Utils.formatDateDDMMYYYY(date)} (${dayOfWeekStr}) - Nessuna rule, usa default: ${isAvailable}`);

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
        }

        return dateDiv;
    },

    changeMonth(delta) {
        CacheManager.clear();
        state.currentDate.setMonth(state.currentDate.getMonth() + delta);
        this.render();
    },
    
jumpToFirstAvailableMonth() {
    console.log("🚀 jumpToFirstAvailableMonth: Inizio scansione...");
    const rules = state.currentService._all_availability_rules;

    if (!rules || rules.length === 0) {
        console.log("⚠️ Nessuna regola disponibile. Rimango su oggi.");
        return;
    }

    // Data di oggi a mezzanotte
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log(`📅 Oggi è: ${today.toLocaleDateString()}`);

    // 1. Filtra regole valide (Future o Presenti + NON Vuote)
    const validRules = rules.filter(rule => {
        // Scarta regole vuote
        if (this.isRuleEmpty(rule)) return false;

        // Controlla fine validità
        if (rule.end_date) {
            const endDate = new Date(rule.end_date);
            endDate.setHours(23, 59, 59, 999);
            if (endDate < today) return false; // Già scaduta
        }
        
        return true;
    });

    if (validRules.length === 0) {
        console.log("⚠️ Nessuna regola valida trovata per il futuro.");
        return;
    }

    // 2. Ordina per data di inizio
    validRules.sort((a, b) => {
        const startA = a.start_date ? new Date(a.start_date) : new Date(0);
        const startB = b.start_date ? new Date(b.start_date) : new Date(0);
        return startA - startB;
    });

    console.log("✅ Regole valide trovate (ordinate):", validRules.map(r => `${r.id} (${r.start_date})`));

    // 3. Prendi la prima regola
    const firstRule = validRules[0];
    let targetDate = firstRule.start_date ? new Date(firstRule.start_date) : new Date();
    
    // Se la regola è iniziata nel passato (es. iniziata 1 Nov, oggi è 26 Nov), 
    // il "primo giorno disponibile" è OGGI, non l'inizio della regola.
    if (targetDate < today) {
        targetDate = new Date(today);
    }

    // 4. Salta al mese della regola se necessario
    // Confrontiamo Anno e Mese
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();

    // Se il mese o l'anno sono futuri
    if (targetYear > currentYear || (targetYear === currentYear && targetMonth > currentMonth)) {
        console.log(`🚀 SALTO TEMPORALE! Da ${today.toLocaleDateString()} a ${targetDate.toLocaleDateString()}`);
        
        // Aggiorna lo stato
        state.currentDate = new Date(targetDate);
        state.currentDate.setDate(1); // Mettiamo 1° del mese per sicurezza rendering
    } else {
        console.log("ℹ️ La prima disponibilità è nel mese corrente. Nessun salto necessario.");
    }
},
};


// HOURS MANAGER
const HoursManager = {
    async render() {
        if (!DOM.hoursGrid || !state.currentService || !state.selectedDate) return;
        DOM.hoursGrid.innerHTML = '<p style="text-align: center; width: 100%;">Caricamento orari...</p>';
        
        try {
            const hours = this.getAvailableHours();
            if (hours.length === 0) {
                DOM.hoursGrid.innerHTML = '<p style="text-align: center; width: 100%;">Nessun orario disponibile.</p>';
                this.disableNextButton();
                return;
            }
            
            const slots = await this.loadSlots();
            const busyInfo = await this.preloadArtisanBusyInfo(hours);
            
            DOM.hoursGrid.innerHTML = '';
            let firstAvailable = null;

            hours.forEach(h => {
                const isBusy = busyInfo[h] || false;
                const btn = this.createHourButton(h, slots, isBusy);
                
                if (!btn.disabled && firstAvailable === null) firstAvailable = h;
                DOM.hoursGrid.appendChild(btn);
            });

            if (firstAvailable !== null) {
                // Opzionale: Seleziona automaticamente il primo orario libero
                // this.selectHour(firstAvailable);
            } else {
                this.disableNextButton();
            }

        } catch (e) {
            console.error("Errore orari:", e);
            DOM.hoursGrid.innerHTML = '<p style="color:red; text-align:center;">Errore caricamento slot.</p>';
        }
    },

    getAvailableHours() {
        // ... (Usa la versione che avevi già nel codice completo, oppure copiala dal mio messaggio precedente se ti serve)
        // Per brevità qui metto la logica standard
        const dayName = CONFIG.DAY_NAMES[(state.selectedDate.getDay() + 6) % 7];
        const duration = state.currentService.duration_minutes / 60;
        
        const rule = CalendarManager.findRuleForDate(state.selectedDate);
        if (rule?.daily_schedules) {
            let schedules = rule.daily_schedules;
            if (Array.isArray(schedules[0])) schedules = schedules.flat();
            const todaySched = schedules.find(s => s.day === dayName);
            if (todaySched) {
                const start = parseInt(todaySched.start.split(':')[0]);
                const end = parseInt(todaySched.end.split(':')[0]);
                const res = [];
                for(let h=start; h<end; h+=duration) res.push(h);
                return res;
            }
        }
        const start = parseInt(state.currentService.working_hours_start.split(':')[0]);
        const end = parseInt(state.currentService.working_hours_end.split(':')[0]);
        const res = [];
        for(let h=start; h<end; h+=duration) res.push(h);
        return res;
    },

    async loadSlots() {
        const cached = CacheManager.get(state.currentService.id, state.selectedDate);
        if (cached) return cached;
        try {
            const slots = await API.getSlots(state.currentService.id, state.selectedDate);
            const safeSlots = Array.isArray(slots) ? slots : [];
            CacheManager.set(state.currentService.id, state.selectedDate, safeSlots);
            return safeSlots;
        } catch (e) { return []; }
    },

    async preloadArtisanBusyInfo(hours) {
        if (!state.currentService._artisan) return {};
        const res = {};
        try {
            const bookings = await API.getArtisanBookings(state.currentService._artisan.id, state.selectedDate);
            hours.forEach(h => { res[h] = this.isArtisanBusy(bookings, h); });
        } catch(e) {}
        return res;
    },

    isArtisanBusy(bookings, hour) {
        if(!bookings || !Array.isArray(bookings)) return false;
        const duration = state.currentService.duration_minutes / 60;
        const start = hour; 
        const end = hour + duration;
        
        return bookings.some(b => {
            if (b.service_id === state.currentService.id) return false;
            // Gestione timestamp o stringa
            const bStartT = b.slot_start_time > 10000000000 ? b.slot_start_time : b.slot_start_time * 1000;
            const bEndT = b.slot_end_time > 10000000000 ? b.slot_end_time : b.slot_end_time * 1000;
            const bStart = new Date(bStartT).getHours();
            const bEnd = new Date(bEndT).getHours();
            return start < bEnd && end > bStart;
        });
    },

    findSlotForHour(slots, hour) {
        if (!slots || !Array.isArray(slots)) return null;
        const ts = Utils.createTimestamp(state.selectedDate, hour);
        // Tolleranza millisecondi se necessario
        return slots.find(s => {
            const sTime = s.start_time > 10000000000 ? s.start_time : s.start_time * 1000;
            return sTime === ts;
        }) || null;
    },

createHourButton(hour, slots, isBusy) {
    const btn = document.createElement('button');
    btn.dataset.hour = String(hour);
    const endHour = hour + (state.currentService.duration_minutes / 60);
    btn.classList.add('button-3', 'w-button');
    btn.setAttribute('type', 'button');

    const slot = this.findSlotForHour(slots, hour);
    let maxCap = state.currentService.max_capacity_per_slot;
    let booked = slot ? (parseInt(slot.booked_count) || 0) : 0;
    let remaining = maxCap - booked;

    // NUOVO: Controlla se Xano ha marcato lo slot come esclusivo
    const isPrivatized = slot && slot.is_exclusive === true;

    let statusText, style = "";
    
    // NUOVO: Ho aggiunto 'isPrivatized' alla condizione di blocco
    if (isBusy || isPrivatized) {
        // NUOVO: Messaggio specifico
        statusText = isPrivatized ? "Evento Privato 🔒" : "Artigiano occupato";
        // NUOVO: Stile leggermente diverso (opzionale)
        style = isPrivatized 
            ? "background:#fef2f2; color:#991b1b; opacity:1; border: 1px solid #fecaca;" 
            : "background:#fee2e2; color:#b91c1c; opacity:0.7;";
        btn.disabled = true;
    } else if (remaining <= 0) {
        statusText = "Posti esauriti";
        style = "opacity:0.5;";
        btn.disabled = true;
    } else if (booked >= 3) {
        statusText = `🔥 CONFERMATO (${remaining} posti)`;
        style = "border: 2px solid #22c55e; background:#f0fdf4; color:#15803d;";
    } else {
        statusText = `${remaining} posti liberi`;
    }

    btn.innerHTML = `
        <div style="font-weight:bold">${hour}:00 - ${endHour}:00</div>
        <div style="font-size:0.8em; margin-top:4px;">${statusText}</div>
    `;
    if(style) btn.style.cssText = style;

    if(!btn.disabled) {
        btn.addEventListener('click', () => {
            this.selectHour(hour);
            PricingManager.update();
            this.updateNumberInputLimit(remaining);
        });
    }
    return btn;
},

    selectHour(hour) {
        state.selectedHour = hour;
        DOM.hoursGrid.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
        DOM.hoursGrid.querySelector(`button[data-hour="${hour}"]`)?.classList.add('selected');

        const slots = CacheManager.get(state.currentService.id, state.selectedDate) || [];
        const slot = this.findSlotForHour(slots, hour);
        const booked = slot ? (parseInt(slot.booked_count) || 0) : 0;

        // Gestione Avviso Giallo
        let notice = document.getElementById("min-pax-notice");
        if(!notice) {
            notice = document.createElement("div");
            notice.id = "min-pax-notice";
            notice.style.cssText = "background:#fffbeb; color:#b45309; padding:12px; border-radius:6px; margin-top:12px; font-size:0.9em; border:1px solid #fcd34d; line-height:1.4;";
            DOM.hoursGrid.after(notice);
        }

        if (booked < 3) {
            notice.style.display = "block";
            notice.innerHTML = booked === 0 
                ? "Sii il primo! Serve un minimo di 3 persone: <strong>se il corso non parte, non ti sarà addebitato nulla</strong>. Preferisci bloccare subito la data? <strong> Prenota in esclusiva.</strong>"
                : `<strong>⚠️ In attesa:</strong> Ci sono ${booked} iscritti. Si parte a 3.<br>Unisciti senza addebito immediato.`;
        } else {
            notice.style.display = "none";
        }

        // Visibilità Extra
        ExtrasManager.updateVisibility(booked);
        
        DOM.nextBtn.disabled = false;
        DOM.nextBtn.classList.remove('disabled');
    },

    updateNumberInputLimit(remaining) {
        if(DOM.numInput) {
            DOM.numInput.max = remaining;
            if(parseInt(DOM.numInput.value) > remaining) DOM.numInput.value = remaining;
        }
    },
    
    disableNextButton(){
        state.selectedHour = null;
        DOM.nextBtn.disabled = true;
        DOM.nextBtn.classList.add("disabled");
    }
};

// EXTRAS MANAGER
const ExtrasManager = {
    render() {
        if (!DOM.extrasContainer || !DOM.extrasTitle) return;
        
        // Recupera dati
        const extras = state.currentService._extra_of_service || state.currentService.extra_of_service || [];
        
        // Se vuoto, nascondi e esci
        if (!extras || extras.length === 0) {
            DOM.extrasContainer.style.display = 'none';
            DOM.extrasTitle.style.display = 'none';
            return;
        }

        // Mostra il contenitore
        DOM.extrasContainer.style.display = 'flex';
        DOM.extrasContainer.style.flexDirection = 'column';
        DOM.extrasContainer.style.gap = '10px';
        DOM.extrasTitle.style.display = 'block';

        // Pulisci tutto il contenuto precedente
        DOM.extrasContainer.innerHTML = '';

        // Genera HTML per ogni extra
        extras.forEach(extra => {
            // 1. Crea il contenitore della riga (Label che avvolge tutto)
            const row = document.createElement('label');
            row.className = "w-checkbox checkbox-field"; // Classi standard Webflow
            row.style.cssText = "display: flex; align-items: center; padding: 10px; cursor: pointer; justify-content: space-between;";
            
            // 2. Prepara i testi
            const priceText = extra.per_person ? `${extra.price}€ / pers` : `${extra.price}€`;
            
            // 3. Crea l'Input Checkbox (con i dati per il prezzo)
            const input = document.createElement('input');
            input.type = "checkbox";
            input.className = "w-checkbox-input";
            input.style.cssText = "margin-right: 10px; width: 20px; height: 20px;"; // Forza dimensioni visibili
            input.id = `extra-${extra.id}`;
            
            // Dataset fondamentali per il calcolo prezzo
            input.dataset.id = extra.id;
            input.dataset.name = extra.name.toLowerCase();
            input.dataset.price = extra.price;
            input.dataset.perPerson = extra.per_person;

            // Event Listener per aggiornare il totale
            input.addEventListener('change', () => PricingManager.update());

            // 4. Crea il testo (Nome e Prezzo)
            const textSpan = document.createElement('span');
            textSpan.className = "checkbox-label-2"; // La tua classe Webflow
            textSpan.style.flexGrow = "1";
            textSpan.textContent = extra.name;

            const priceSpan = document.createElement('span');
            priceSpan.className = "text-block-11"; // La tua classe Webflow
            priceSpan.style.fontWeight = "bold";
            priceSpan.style.color = "#666";
            priceSpan.textContent = `+ ${priceText}`;

            // 5. Assembla tutto
            row.appendChild(input);
            row.appendChild(textSpan);
            row.appendChild(priceSpan);

            // 6. Aggiungi alla pagina
            DOM.extrasContainer.appendChild(row);
        });
    },

    updateVisibility(bookedCount) {
        if (!DOM.extrasContainer) return;
        
        // Seleziona le righe appena create
        const rows = DOM.extrasContainer.children; // Sono i tag <label>
        
        Array.from(rows).forEach(row => {
            const checkbox = row.querySelector("input[type='checkbox']");
            if (!checkbox) return;
            
            const name = (checkbox.dataset.name || "").toLowerCase();
            const isPrivatization = name.includes("privatizz") || name.includes("esclusiva");
            
            // LOGICA: Nascondi Privatizzazione se c'è gente
            if (isPrivatization && bookedCount > 0) {
                row.style.display = 'none';
                if (checkbox.checked) {
                    checkbox.checked = false;
                    PricingManager.update();
                }
            } else {
                row.style.display = 'flex'; // Importante rimettere flex
            }
        });
    }
};


// PRICING MANAGER
const PricingManager = {
    update() {
        if (!state.currentService) return;
        
        const numPeople = Math.max(1, parseInt(DOM.numInput.value) || 1);
        const maxCapacity = this.getActualAvailableSpots();
        
        const { unitPrice, extraCost, totalPrice } = this.calculatePricing(numPeople);

        this.updatePeopleText(numPeople, unitPrice);
        this.updateExtraRecap(extraCost);
        this.updateTotalPrice(numPeople, unitPrice, totalPrice);
        this.updateCapacityNotice(numPeople, maxCapacity);
        this.updateNextButtonState(numPeople, maxCapacity);
        this.updateInputMaxLimit(maxCapacity);
        
        // Badge sconto gruppi (versione elegante)
        this.updateDiscountBadge(numPeople, unitPrice);
    },

    getActualAvailableSpots() {
        if (!state.currentService) return 8;
        // Recupera slot dalla cache per coerenza
        const slots = CacheManager.get(state.currentService.id, state.selectedDate);
        const slot = HoursManager.findSlotForHour(slots, state.selectedHour);
        
        if (slot) return parseInt(slot.capacity) - (parseInt(slot.booked_count) || 0);
        return state.currentService.max_capacity_per_slot;
    },

    calculatePricing(numPeople) {
        let unitPrice = parseFloat(state.currentService.base_price) || 0;
        
        // 1. Applica prezzo a scaglioni (Tiered Pricing)
        if (state.currentService._service_prices?.length > 0) {
            const tier = state.currentService._service_prices.find(t => 
                numPeople >= t.min_people && numPeople <= t.max_people
            );
            if (tier && tier.retail_price) {
                unitPrice = parseFloat(tier.retail_price);
            }
        }

        // 2. Somma costi Extra Multipli
        let extraCost = 0;
        const checkedBoxes = DOM.extrasContainer?.querySelectorAll("input[type='checkbox']:checked");
        
        if (checkedBoxes) {
            checkedBoxes.forEach(cb => {
                const p = parseFloat(cb.dataset.price) || 0;
                const isPerPerson = cb.dataset.perPerson === "true";
                extraCost += isPerPerson ? (p * numPeople) : p;
            });
        }

        return { unitPrice, extraCost, totalPrice: (unitPrice * numPeople) + extraCost };
    },

    updateDiscountBadge(currentPax, currentPrice) {
        const badge = document.getElementById('dynamic-discount-badge');
        if (!badge) return;
        
        const prices = state.currentService._service_prices || [];
        if (prices.length === 0) { badge.style.display = 'none'; return; }

        const minPriceAbs = Math.min(...prices.map(p => parseFloat(p.retail_price)));
        
        // Mostra solo se l'utente ha ottenuto la tariffa migliore (Gruppo esteso)
        if (currentPrice <= minPriceAbs && currentPax >= 11) {
            badge.style.display = 'block';
            badge.style.color = '#4a3f35';
            badge.style.backgroundColor = '#fdfaf6';
            badge.style.border = '1px solid #eaddd0';
            badge.innerHTML = `Tariffa gruppo esteso applicata (${currentPrice.toFixed(0)}€/pax)`;
        } else {
            badge.style.display = 'none';
        }
    },

    updatePeopleText(n, p) {
        if(DOM.peopleText) DOM.peopleText.textContent = `${n} ${n===1?'persona':'persone'} × ${p.toFixed(2)}€`;
        if(DOM.totalText) DOM.totalText.textContent = `${n} × ${p.toFixed(2)}€`;
    },

    updateExtraRecap(cost) {
        const el = document.querySelector(".recap-step2.extra-hidden.extra-lable");
        if(el) {
            el.style.display = cost > 0 ? "flex" : "none";
            const span = el.querySelector(".w-embed:nth-child(2) .my-span-class");
            if(span) span.textContent = `${cost.toFixed(2)}€`;
        }
    },

    updateTotalPrice(n, u, t) {
        if(DOM.totalPrice) DOM.totalPrice.textContent = `${t.toFixed(2)}€`;
    },

    updateCapacityNotice(n, max) {
        let el = document.querySelector(".max-capacity-notice");
        if(!el && DOM.numInput) {
            el = document.createElement("div");
            el.classList.add("max-capacity-notice");
            el.style.marginTop = "5px";
            DOM.numInput.insertAdjacentElement("afterend", el);
        }
        if(el) {
            const left = max - n;
            el.textContent = left < 0 ? `Posti esauriti` : `${left} posti disponibili`;
            el.style.color = left < 0 ? "red" : "green";
        }
    },

    updateNextButtonState(n, max) {
        if(DOM.nextBtn) DOM.nextBtn.disabled = n > max;
    },

    updateInputMaxLimit(max) {
        if(DOM.numInput) {
            DOM.numInput.max = max;
            if(parseInt(DOM.numInput.value) > max) DOM.numInput.value = max;
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
        if (this.validateBooking()) {
            DOM.nextBtn.disabled = true;
            DOM.nextBtn.textContent = "Elaborazione...";
            try {
                const data = this.prepareBookingData();
                console.log("🔵 1. Dati inviati a complete_booking:", data);
                
                // Chiamata 1: Crea prenotazione su Xano
                const res = await API.createBooking(data);
                
                // --- DEBUG: Analisi risposta Xano ---
                console.log("🟢 2. Risposta RAW da Xano:", res);
                
                // TENTATIVO DI RECUPERO ID ROBUSTO
                // Cerca l'ID ovunque possa nascondersi (diretto, in .response, o dentro l'oggetto booking)
                const idReale = res.booking_id || (res.response && res.response.booking_id) || (res.booking && res.booking.id);
                
                // TENTATIVO DI RECUPERO PREZZO
                const prezzoReale = res.total_price || (res.response && res.response.total_price) || 0;

                console.log(`🔶 4. Valori estratti -> ID: ${idReale}, Prezzo: ${prezzoReale}`);

                if (!idReale) {
                    throw new Error("⛔ ID PRENOTAZIONE NON TROVATO NELLA RISPOSTA! Controlla i log sopra.");
                }

                // Chiamata 2: Crea sessione Stripe (Usando processPayment per coerenza)
                await this.processPayment(data.user_email, prezzoReale, idReale);

            } catch (e) {
                console.error("❌ ERRORE:", e);
                Utils.showError(e.message);
                DOM.nextBtn.disabled = false;
                DOM.nextBtn.textContent = "Riprova";
            }
        }
    },

    prepareBookingData() {
        return {
            user_name: DOM.nameInput.value.trim(),
            user_email: DOM.emailInput.value.trim(), 
            user_phone: DOM.phoneInput?.value.trim() || "",
            service_id: state.currentService.id,
            selected_date: Utils.formatDateISO(state.selectedDate),
            selected_hour: Utils.createTimestamp(state.selectedDate, state.selectedHour),
            num_people: parseInt(DOM.numInput.value) || 1,
            // Importante: extra_ids è un array, gestito dalla funzione sotto
            extra_ids: this.getSelectedExtraIds()
        };
    },

    getSelectedExtraIds() {
        const checkedBoxes = DOM.extrasContainer?.querySelectorAll("input[type='checkbox']:checked");
        if (!checkedBoxes || checkedBoxes.length === 0) return [];
        // Restituisce array di interi (es: [29, 23])
        return Array.from(checkedBoxes).map(cb => parseInt(cb.dataset.id));
    },

    validateBooking() {
        if (!DOM.nameInput.value || !DOM.emailInput.value) {
            Utils.showError("Per favore compila i campi obbligatori");
            return false;
        }
        if (!Utils.isValidEmail(DOM.emailInput.value)) {
            Utils.showError("Inserisci un indirizzo email valido");
            return false;
        }
        if (!DOM.gdprCheckbox.checked) {
            Utils.showError("Devi accettare la privacy policy");
            return false;
        }
        return true;
    },

    // Funzione helper per il pagamento
    async processPayment(userEmail, totalAmountInCents, bookingId) {
        console.log("🚀 5. Chiamata a Stripe Checkout...");

        try {
            const stripeData = await API.createStripeCheckout(
                userEmail,
                totalAmountInCents,
                bookingId
            );

            console.log("🏁 6. Risposta Stripe ricevuta:", stripeData);

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
                    'Errore tecnico nel pagamento. La prenotazione ID ' + bookingId + ' è stata salvata. Contatta il supporto.'
                );
            }
            throw error;
        }
    },
    
    // Fallback per recuperare l'ID se la prima chiamata fallisce (Opzionale, ma utile tenerlo)
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
            CalendarManager.jumpToFirstAvailableMonth();

            CalendarManager.render();
            ExtrasManager.render();
            PricingManager.update();
            this.updateDiscountBanner();
            StepNavigation.goToStep(1);

        } catch (error) {
            console.error("❌ Errore nel caricamento del servizio:", error);
            Utils.showError("Impossibile caricare il servizio. Riprova.");
        }
    },
    // Funzione per gestire il banner dinamico
    updateDiscountBanner() {
        const banner = document.getElementById('group-discount-banner');
        if (!banner || !state.currentService) return;

        // 1. Prezzi base
        const basePrice = parseFloat(state.currentService.base_price) || 0;
        const prices = state.currentService._service_prices || [];

        // 2. Cerchiamo la prima fascia "Gruppo" (minimo 3 persone)
        // Ordiniamo per numero persone crescente
        const groupTier = prices
            .filter(p => p.min_people >= 3)
            .sort((a, b) => a.min_people - b.min_people)[0];

        // 3. Valutiamo se mostrare il banner
        if (groupTier && parseFloat(groupTier.retail_price) < basePrice) {
            
            const groupPrice = parseFloat(groupTier.retail_price);
            const minPeople = groupTier.min_people;
            const saving = basePrice - groupPrice;

            // OPZIONALE: Mostra solo se il risparmio è rilevante (es. > 3€)
            if (saving < 3) {
                banner.style.display = 'none';
                return;
            }

            // Formattazione prezzo (es. "205,00 €")
            // Moltiplichiamo per 100 perché Utils.formatCurrency si aspetta centesimi
            const formattedPrice = Utils.formatCurrency(groupPrice * 100);

            // Iniettiamo il testo
            banner.innerHTML = `
                <strong>👥 Sconto Gruppi:</strong><br>
                Prenota per ${minPeople} o più persone: il prezzo scende a <strong>${formattedPrice}</strong> a testa!
            `;
            
            // Mostriamo il box
            banner.style.display = 'block';
            
        } else {
            // Nessuno sconto o gruppo non configurato -> Nascondi
            banner.style.display = 'none';
        }
    },
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