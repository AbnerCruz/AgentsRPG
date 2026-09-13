export const DEFAULT_BALANCE=Object.freeze({
 hungerRate:0.00084,
 thirstRate:0.00068,
 sleepRate:0.0008,
 starvationDamage:0.00065,
 temperatureDamage:0.00055,
 forageYieldMult:0.50,
 waterYieldMult:1,
 movementBase:0.30,
 passiveStaminaRecovery:0.00035,
 safetyNightGain:0.0022,
 safetyShelterRecovery:0.0016,
 purposeIdleGain:0.0007,
 purposeRoutineGain:0.00005,
 purposeExploreRelief:0.001,
 perceptionShortMult:1,
 perceptionLongMult:1,
 experimentInterval:40,
 experimentChanceMult:1,
 experimentGainMult:1,
 fertilityBase:0.045,
 diseaseLethalityMult:1,
 diseaseSpreadMult:1,
 bossUnlockDay:250
});

export const BALANCE={...DEFAULT_BALANCE};
export function setBalanceOverrides(overrides={}){for(const [k,v] of Object.entries(overrides)){if(!(k in DEFAULT_BALANCE))throw new Error(`Parâmetro de balanceamento desconhecido: ${k}`);const n=Number(v);if(!Number.isFinite(n))throw new Error(`Valor inválido para ${k}`);BALANCE[k]=n}return BALANCE}
export function resetBalance(){Object.assign(BALANCE,DEFAULT_BALANCE);return BALANCE}
export function balanceSnapshot(){return{...BALANCE}}
