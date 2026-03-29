// Surface absorption coefficients (0 = full reflection, 1 = full absorption)
// Inspired by Vercidium's material-based sound absorption

export const MATERIALS = {
  concrete: { absorption: 0.02, name: 'concrete' },
  wood: { absorption: 0.1, name: 'wood' },
  carpet: { absorption: 0.4, name: 'carpet' },
  metal: { absorption: 0.01, name: 'metal' },
  glass: { absorption: 0.05, name: 'glass' },
  fabric: { absorption: 0.5, name: 'fabric' },
  default: { absorption: 0.05, name: 'default' },
};

export function getAbsorption(materialName) {
  return (MATERIALS[materialName] || MATERIALS.default).absorption;
}
