/**
 * 运动引擎
 * 管理摄像机运动、摇镜、推镜等
 */
class MotionEngine {
    constructor() {
        this.cameraMoves = {
            static: { movement: 'none', speed: 0 },
            pan: { movement: 'horizontal', direction: 'left_right', speed: 0.5 },
            tilt: { movement: 'vertical', direction: 'up_down', speed: 0.5 },
            dolly_in: { movement: 'forward', speed: 0.3, intensity: 'build' },
            dolly_out: { movement: 'backward', speed: 0.3, intensity: 'reveal' },
            push_in: { movement: 'zoom_in', speed: 0.2, intensity: 'focus' },
            pull_out: { movement: 'zoom_out', speed: 0.4, intensity: 'reveal' },
            handheld: { movement: 'shake', intensity: 'variable', style: 'documentary' },
            tracking: { movement: 'follow', subject: 'target', smoothness: 0.8 },
            crane: { movement: 'arc', height: 'high', speed: 0.2 }
        };
    }

    selectCameraMove(emotion, shotDuration) {
        const moveMap = {
            tension: 'push_in',
            reveal: 'dolly_out',
            epic: 'crane',
            intimacy: 'static',
            chaos: 'handheld',
            pursuit: 'tracking',
            calm: 'static'
        };
        
        const moveName = moveMap[emotion] || 'static';
        const move = { ...this.cameraMoves[moveName] };
        
        // 根据镜头时长调整速度
        if (shotDuration < 2) {
            move.speed *= 1.5;
        } else if (shotDuration > 5) {
            move.speed *= 0.6;
        }
        
        return {
            name: moveName,
            ...move
        };
    }

    calculateMotionBlur(speed, shutterAngle = 180) {
        // 计算运动模糊强度
        return Math.min(speed * shutterAngle / 360, 1);
    }
}

module.exports = new MotionEngine();
