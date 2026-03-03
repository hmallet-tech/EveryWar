// js/mapConfig.js – Mutable map dimensions, set before Game creation
// Large=128, Medium=85 (2/3), Small=64 (1/2)
export const MapConfig = {
    W: 85,
    H: 85,
    setSize(sizeKey) {
        const sizes = {
            small: { W: 64, H: 64 },
            medium: { W: 85, H: 85 },
            large: { W: 128, H: 128 },
        };
        const s = sizes[sizeKey] || sizes.medium;
        this.W = s.W;
        this.H = s.H;
    }
};
