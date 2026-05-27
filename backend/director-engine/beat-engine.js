/**
 * 节拍引擎
 * 控制分镜节奏与情绪节拍
 */
class BeatEngine {
    constructor() {
        this.beatPatterns = {
            fast_cut: { interval: 0.5, duration: 2 },
            slow_push: { interval: 2, duration: 5 },
            pause: { interval: 0, duration: 3 },
            explosion: { interval: 0.3, duration: 1 },
            hook_hold: { interval: 0, duration: 4 }
        };
    }

    calculateBeatPattern(emotion, intensity) {
        const pattern = this.beatPatterns[emotion] || this.beatPatterns.fast_cut;
        return { ...pattern, intensity };
    }

    generateShotDuration(pattern) {
        return pattern.duration * (1 + Math.random() * 0.2);
    }
}

module.exports = new BeatEngine();
