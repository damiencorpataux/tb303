class TB303 {
    constructor(audioContext) {
        this.context = audioContext;

        /* =======================
           USER PARAMETERS
        ======================== */

        this.waveform = "sawtooth"; // "sawtooth" or "square"
        this.tune = 0;              // detune in cents
        this.attack = 0.002; // seconds
        this.cutoff = 800;          // base cutoff frequency
        this.resonance = 8;         // filter Q
        this.envMod = 2000;         // envelope modulation amount
        this.decay = 0.2;           // filter decay time
        this.accentAmount = 0.4;    // accent intensity (0-1)
        this.volume = 0.6;
        this.slideTime = 0.06;

        /* =======================
           INTERNAL STATE
        ======================== */

        this.previousSlide = false;
        this.currentNote = null;

        /* =======================
           AUDIO GRAPH
        ======================== */

        this.osc = this.context.createOscillator();
        this.osc.type = this.waveform;

        this.filter1 = this.context.createBiquadFilter();
        this.filter1.type = "lowpass";

        this.filter2 = this.context.createBiquadFilter();
        this.filter2.type = "lowpass";

        this.amp = this.context.createGain();
        this.amp.gain.value = 0;

        // chain
        this.osc.connect(this.filter1);
        this.filter1.connect(this.filter2);
        this.filter2.connect(this.amp);
        this.amp.connect(this.context.destination);

        this.osc.start();
    }

    /* =======================
       PUBLIC METHODS
    ======================== */

    note_on(note, { accent = false, slide = false } = {}) {
        const now = this.context.currentTime;

        const freq = 440 * Math.pow(2, (note - 69) / 12);

        /* --- Pitch / Slide --- */
        this.osc.detune.value = this.tune;

        if (this.previousSlide) {
            this.osc.frequency.setValueAtTime(
                this.osc.frequency.value,
                now
            );
            this.osc.frequency.linearRampToValueAtTime(
                freq,
                now + this.slideTime
            );
        } else {
            this.osc.frequency.setValueAtTime(freq, now);
        }

        /* --- Amplitude Envelope --- */

        const baseVol = this.volume;
        const vol = accent
            ? baseVol + this.accentAmount * 0.3
            : baseVol;

        if (!this.previousSlide) {
            this.amp.gain.cancelScheduledValues(now);
            this.amp.gain.setValueAtTime(0, now);

            // ATTACK
            this.amp.gain.linearRampToValueAtTime(
                vol,
                now + this.attack
            );
        }

        // Decay
        this.amp.gain.exponentialRampToValueAtTime(
            0.001,
            now + this.attack + 0.3
        );

        /* --- Filter --- */
        this.filter1.Q.value = this.resonance;
        this.filter2.Q.value = this.resonance;

        const envAmount = this.envMod;
        const cutoffStart = accent
            ? this.cutoff + envAmount * 1.5
            : this.cutoff + envAmount;

        const cutoffEnd = this.cutoff;

        this.filter1.frequency.cancelScheduledValues(now);
        this.filter2.frequency.cancelScheduledValues(now);

        this.filter1.frequency.setValueAtTime(cutoffStart, now);
        this.filter2.frequency.setValueAtTime(cutoffStart, now);

        this.filter1.frequency.exponentialRampToValueAtTime(
            cutoffEnd,
            now + this.decay
        );
        this.filter2.frequency.exponentialRampToValueAtTime(
            cutoffEnd,
            now + this.decay
        );

        this.previousSlide = slide;
        this.currentNote = note;
    }

    note_off() {
        const now = this.context.currentTime;
        this.amp.gain.cancelScheduledValues(now);
        this.amp.gain.linearRampToValueAtTime(0, now + 0.05);
        this.previousSlide = false;
        this.currentNote = null;
    }
}
