/**
 * 镜头引擎
 * 管理摄像机参数、镜头选择
 */
class LensEngine {
    constructor() {
        this.lensTypes = {
            wide: { focalLength: 14, fov: 100, distortion: 0.1 },
            normal: { focalLength: 50, fov: 40, distortion: 0 },
            portrait: { focalLength: 85, fov: 24, distortion: 0 },
            telephoto: { focalLength: 200, fov: 10, distortion: -0.05 },
            fish_eye: { focalLength: 8, fov: 180, distortion: 0.8 }
        };
    }

    selectLens(shotType, emotion) {
        const lensMap = {
            closeup: 'portrait',
            wide_shot: 'wide',
            establishing: 'wide',
            pov: 'normal',
            action: 'telephoto'
        };
        
        const lensName = lensMap[shotType] || 'normal';
        return {
            ...this.lensTypes[lensName],
            name: lensName
        };
    }

    calculateCameraAngle(emotion) {
        const angleMap = {
            oppression: 'low_angle',
            weakness: 'high_angle',
            neutral: 'eye_level',
            drama: 'dutch_angle',
            epic: 'extreme_low'
        };
        return angleMap[emotion] || 'eye_level';
    }
}

module.exports = new LensEngine();
