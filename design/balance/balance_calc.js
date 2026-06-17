/**
 * balance_calc.js
 * Dictator Simulator — Balance Calculator
 * Re-run with: node balance_calc.js
 *
 * All constants are inlined from src/Constants/GameState.ts, src/Constants/Costs.ts,
 * src/Stores/BudgetHandler.ts, src/Stores/ActionHandler.ts, src/assets/dailyEvents.ts,
 * src/assets/deals.ts, and src/assets/laws.ts.
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────

const INCOME = {
    PEOPLE_BASE: 200,
    BUSINESS_BASE: 180,
    EXPENDITURE_COST_PER_LEVEL: 10,
    TAX_PENALTY_PEOPLE_THRESHOLD: 30,
    TAX_PENALTY_BUSINESS_THRESHOLD: 45,
};

const BUDGET_EFFECTS = {
    SECURITY:       { LOW: 3, HIGH: 7 },
    HEALTH:         { LOW: 3, HIGH: 7 },
    INFRASTRUCTURE: { LOW: 3, HIGH: 7 },
};

const RELATIONS = { INITIAL: 0, MIN: -10, MAX: 10 };
const CHARISMA  = { INITIAL: 0, MIN: -10, MAX: 10 };
const ROUNDS    = { MAX: 10, TIME_LENGTH_MS: 5 * 60 * 1000 };

const BRIBE_COSTS       = { military: 60, business: 80, people: 40 };
const EXPROPRIATE_GAINS = { military: 80, business: 120, people: 30 };
const DIALOGUE_BASE_SUCCESS_RATE = { military: 0.4, business: 0.3, people: 0.8 };

const DEFAULT_EXPENDITURES = { health: 3, infrastructure: 3, security: 3, education: 3 };
const DEFAULT_TAXES        = { peopleTaxes: 30, businessTaxes: 40 };
const STARTING_TREASURY    = 500;

const COSTS = { SMALL: 10, MEDIUM: 20, LARGE: 50 };
const GAINS = { SMALL: 1,  MEDIUM: 2,  LARGE: 3  };

// ─── Daily Events (from src/assets/dailyEvents.ts) ────────────────────────────

const DAILY_EVENTS = [
    // TERRIBLE (low chance, high negative)
    { power: "military", key: "military_coup_attempt",          mod: -3, chance: 5  },
    { power: "people",   key: "health_epidemic",                mod: -3, chance: 8  },
    { power: "business", key: "foreign_investors_withdraw",     mod: -3, chance: 10 },
    { power: "people",   key: "natural_disaster",               mod: -3, chance: 12 },
    // SEVERE (moderate-low chance, significant negative)
    { power: "military", key: "regional_conflicts",             mod: -2, chance: 20 },
    { power: "people",   key: "labor_strikes",                  mod: -2, chance: 25 },
    { power: "business", key: "international_sanctions",        mod: -2, chance: 15 },
    { power: "people",   key: "inflation_spike",                mod: -2, chance: 30 },
    { power: "military", key: "cyber_attack",                   mod: -2, chance: 18 },
    { power: "business", key: "smuggling_exposed",              mod: -2, chance: 22 },
    // MODERATE NEGATIVE (higher chance, moderate impact)
    { power: "people",   key: "economic_unrest",                mod: -1, chance: 40 },
    { power: "military", key: "border_tension",                 mod: -1, chance: 35 },
    { power: "business", key: "government_interference_concern",mod: -1, chance: 38 },
    { power: "people",   key: "opposition_protests",            mod: -1, chance: 45 },
    { power: "military", key: "stability_concerns",             mod: -1, chance: 35 },
    { power: "people",   key: "corruption_scandal",             mod: -1, chance: 30 },
    { power: "people",   key: "media_leaks",                    mod: -1, chance: 28 },
    { power: "people",   key: "religious_mobilization",         mod: -1, chance: 32 },
    { power: "business", key: "infrastructure_failure",         mod: -1, chance: 25 },
    { power: "business", key: "tech_regulations_anger",         mod: -1, chance: 35 },
    { power: "people",   key: "aid_delayed",                    mod: -1, chance: 30 },
    { power: "people",   key: "transport_strikes",              mod: -1, chance: 40 },
    { power: "business", key: "environmental_protests",         mod: -1, chance: 33 },
    { power: "people",   key: "official_scandal",               mod: -1, chance: 35 },
    // POSITIVE
    { power: "people",   key: "politician_support",             mod: 1,  chance: 25 },
    { power: "military", key: "military_parade",                mod: 1,  chance: 22 },
    { power: "military", key: "joint_exercises",                mod: 1,  chance: 20 },
    { power: "business", key: "trade_agreement",                mod: 1,  chance: 25 },
    { power: "business", key: "investment_summit",              mod: 1,  chance: 20 },
    { power: "people",   key: "public_works_milestone",         mod: 1,  chance: 22 },
    { power: "military", key: "defence_commendation",           mod: 2,  chance: 8  },
    { power: "business", key: "economic_boom",                  mod: 2,  chance: 8  },
    { power: "people",   key: "national_holiday_celebration",   mod: 1,  chance: 20 },
    { power: "people",   key: "government_aid_praised",         mod: 1,  chance: 22 },
    { power: "people",   key: "healthcare_clinic_opens",        mod: 1,  chance: 20 },
    { power: "people",   key: "student_grant_programme",        mod: 1,  chance: 18 },
];

// ─── Deals (treasury effects summarised) ─────────────────────────────────────

const DEALS = [
    { id:  1, acceptEffect: { treasury: -50, military: 2, risk: 0.3 }, rejectEffect: { military: 1 } },
    { id:  2, acceptEffect: { treasury: 80, business: 1, people: -2 }, rejectEffect: { people: 1, business: -1 } },
    { id:  3, acceptEffect: { treasury: -40, military: 1 }, rejectEffect: { risk: 0.2 } },
    { id:  4, acceptEffect: { treasury: -30, people: 2 }, rejectEffect: { people: 0 } },
    { id:  5, acceptEffect: { treasury: -60, military: 2, people: -1 }, rejectEffect: { people: 1 } },
    { id:  6, acceptEffect: { treasury: -70, military: 3 }, rejectEffect: { military: -2 } },
    { id:  7, acceptEffect: { treasury: 50, military: 2, risk: 0.4 }, rejectEffect: { military: 1 } },
    { id:  8, acceptEffect: { treasury: -30, military: -1, business: 2 }, rejectEffect: { military: 1, business: -2 } },
    { id:  9, acceptEffect: { treasury: 100, business: 2, people: -2 }, rejectEffect: { business: -2 } },
    { id: 10, acceptEffect: { treasury: 120, business: 1, military: -1 }, rejectEffect: { business: 1 } },
    { id: 11, acceptEffect: { treasury: 40, business: 1, people: -1 }, rejectEffect: { people: 1 } },
    { id: 12, acceptEffect: { treasury: 80, business: 1, risk: 0.25 }, rejectEffect: { business: -2, military: -1 } },
    { id: 13, acceptEffect: { treasury: -20, people: 2 }, rejectEffect: { people: -2 } },
    { id: 14, acceptEffect: { treasury: -60, people: 3 }, rejectEffect: { people: -2, military: 1 } },
    { id: 15, acceptEffect: { people: 1, business: 1, risk: 0.3 }, rejectEffect: { people: -2, business: -1 } },
];

// ─── Laws (sample — all 39 defined, treasury effects pulled out) ──────────────

const LAWS = [
    // Military
    { id:  0, power: "military", accept: { treasury: -COSTS.MEDIUM, security: GAINS.SMALL, military: GAINS.SMALL }, reject: { military: -GAINS.SMALL, business: GAINS.SMALL } },
    { id:  1, power: "military", accept: { people: -GAINS.SMALL, military: GAINS.SMALL }, reject: { military: -GAINS.MEDIUM, business: -GAINS.SMALL, people: GAINS.SMALL } },
    { id:  2, power: "military", accept: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, security: GAINS.SMALL, people: -GAINS.SMALL }, reject: { military: -GAINS.SMALL, people: GAINS.SMALL } },
    { id:  3, power: "military", accept: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, people: -GAINS.SMALL }, reject: { military: -GAINS.SMALL, people: GAINS.SMALL } },
    { id:  4, power: "military", accept: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, business: -GAINS.SMALL, security: GAINS.SMALL }, reject: { military: -GAINS.MEDIUM, people: GAINS.SMALL } },
    { id:  5, power: "military", accept: { military: GAINS.SMALL, people: -GAINS.MEDIUM, education: GAINS.SMALL }, reject: { military: -GAINS.SMALL, people: GAINS.SMALL } },
    { id:  6, power: "military", accept: { military: GAINS.SMALL, business: -GAINS.SMALL, people: -GAINS.SMALL }, reject: { military: -GAINS.SMALL, people: GAINS.SMALL } },
    { id:  7, power: "military", accept: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL }, reject: { military: -GAINS.SMALL } },
    { id:  8, power: "military", accept: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, security: GAINS.MEDIUM }, reject: { military: -GAINS.SMALL, business: GAINS.SMALL } },
    { id:  9, power: "military", accept: { people: -GAINS.SMALL, military: GAINS.SMALL }, reject: { military: -GAINS.SMALL } },
    { id: 10, power: "military", accept: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, people: GAINS.SMALL }, reject: { military: -GAINS.SMALL, people: -GAINS.SMALL } },
    { id: 11, power: "military", accept: { treasury: -COSTS.MEDIUM, military: GAINS.SMALL, people: -GAINS.SMALL }, reject: { military: -GAINS.SMALL } },
    { id: 12, power: "military", accept: { treasury: -COSTS.SMALL, people: -GAINS.SMALL, military: GAINS.SMALL }, reject: { military: -GAINS.SMALL } },
    // Business
    { id: 13, power: "business", accept: { businessTaxes: -GAINS.SMALL, business: GAINS.SMALL, people: -GAINS.SMALL }, reject: { business: -GAINS.SMALL, people: GAINS.SMALL } },
    { id: 14, power: "business", accept: { people: -GAINS.SMALL, business: GAINS.SMALL, businessTaxes: -GAINS.SMALL }, reject: { business: -GAINS.SMALL, people: GAINS.SMALL } },
    { id: 15, power: "business", accept: { treasury: GAINS.SMALL, business: GAINS.SMALL, people: GAINS.SMALL }, reject: { business: -GAINS.SMALL, people: -GAINS.SMALL } },
    { id: 16, power: "business", accept: { treasury: -COSTS.LARGE, people: -GAINS.SMALL, business: GAINS.SMALL }, reject: { business: -GAINS.SMALL, military: GAINS.SMALL } },
    { id: 17, power: "business", accept: { people: -GAINS.MEDIUM, business: GAINS.SMALL }, reject: { business: -GAINS.SMALL, people: GAINS.SMALL } },
    { id: 18, power: "business", accept: { treasury: -COSTS.MEDIUM, business: GAINS.MEDIUM, people: -GAINS.SMALL }, reject: { business: -GAINS.SMALL, people: GAINS.SMALL } },
    { id: 19, power: "business", accept: { treasury: GAINS.SMALL, business: GAINS.SMALL, people: -GAINS.SMALL }, reject: { business: -GAINS.SMALL, people: GAINS.SMALL } },
    { id: 20, power: "business", accept: { treasury: COSTS.LARGE, business: GAINS.MEDIUM, people: -GAINS.MEDIUM, military: -GAINS.SMALL }, reject: { business: -GAINS.SMALL, people: GAINS.SMALL } },
    { id: 21, power: "business", accept: { treasury: GAINS.SMALL, business: GAINS.SMALL, people: -GAINS.SMALL, military: -GAINS.SMALL }, reject: { business: -GAINS.SMALL, military: GAINS.SMALL } },
    { id: 22, power: "business", accept: { treasury: -COSTS.MEDIUM, businessTaxes: -GAINS.SMALL, people: -GAINS.SMALL, business: GAINS.SMALL }, reject: { business: -GAINS.SMALL, people: GAINS.SMALL } },
    { id: 23, power: "business", accept: { treasury: -COSTS.MEDIUM, business: GAINS.SMALL, people: -GAINS.SMALL, military: -GAINS.SMALL }, reject: { business: -GAINS.SMALL, military: GAINS.SMALL } },
    { id: 24, power: "business", accept: { treasury: -COSTS.MEDIUM, people: GAINS.SMALL, business: GAINS.SMALL, military: -GAINS.SMALL }, reject: { business: -GAINS.SMALL, people: -GAINS.SMALL, military: GAINS.SMALL } },
    { id: 25, power: "business", accept: { business: GAINS.SMALL, people: -GAINS.MEDIUM, military: GAINS.SMALL }, reject: { business: -GAINS.SMALL, military: -GAINS.SMALL, people: GAINS.SMALL } },
    // People
    { id: 26, power: "people", accept: { people: GAINS.SMALL, treasury: -COSTS.LARGE, business: -GAINS.SMALL }, reject: { people: -GAINS.SMALL, business: GAINS.SMALL } },
    { id: 27, power: "people", accept: { treasury: -COSTS.MEDIUM, health: GAINS.SMALL, people: GAINS.SMALL }, reject: { people: -GAINS.SMALL, business: GAINS.SMALL } },
    { id: 28, power: "people", accept: { treasury: -COSTS.MEDIUM, education: GAINS.SMALL, people: GAINS.SMALL, business: -GAINS.SMALL, military: -GAINS.MEDIUM }, reject: { people: -GAINS.SMALL, business: -GAINS.SMALL, military: -GAINS.SMALL } },
    { id: 29, power: "people", accept: { treasury: GAINS.SMALL, business: -GAINS.SMALL, people: GAINS.SMALL, security: GAINS.SMALL, infrastructure: GAINS.SMALL }, reject: { people: -GAINS.SMALL, business: GAINS.SMALL } },
    { id: 30, power: "people", accept: { treasury: -COSTS.LARGE, people: GAINS.SMALL, military: GAINS.SMALL, business: -GAINS.SMALL }, reject: { people: -GAINS.SMALL, military: -GAINS.SMALL, business: GAINS.SMALL } },
    { id: 31, power: "people", accept: { treasury: -COSTS.MEDIUM, people: GAINS.SMALL, infrastructure: GAINS.SMALL, military: GAINS.SMALL, business: -GAINS.SMALL }, reject: { people: -GAINS.SMALL, military: -GAINS.SMALL, business: GAINS.SMALL } },
    { id: 32, power: "people", accept: { business: -GAINS.MEDIUM, people: GAINS.SMALL, businessTaxes: GAINS.SMALL }, reject: { people: -GAINS.SMALL, military: GAINS.SMALL } },
    { id: 33, power: "people", accept: { treasury: -COSTS.MEDIUM, infrastructure: GAINS.SMALL, people: GAINS.SMALL, business: GAINS.SMALL }, reject: { people: -GAINS.SMALL, business: -GAINS.SMALL } },
    { id: 34, power: "people", accept: { people: GAINS.SMALL, business: GAINS.SMALL, military: -GAINS.SMALL, infrastructure: GAINS.SMALL }, reject: { people: -GAINS.SMALL, business: -GAINS.SMALL } },
    { id: 35, power: "people", accept: { treasury: -COSTS.MEDIUM, infrastructure: GAINS.SMALL, people: GAINS.SMALL, business: -GAINS.SMALL }, reject: { people: -GAINS.SMALL, business: GAINS.SMALL } },
    { id: 36, power: "people", accept: { treasury: -COSTS.MEDIUM, people: GAINS.SMALL, health: GAINS.SMALL }, reject: { people: -GAINS.SMALL, business: GAINS.SMALL } },
    { id: 37, power: "people", accept: { treasury: -COSTS.MEDIUM, people: GAINS.SMALL, military: GAINS.SMALL, infrastructure: GAINS.SMALL, business: -GAINS.SMALL }, reject: { people: -GAINS.SMALL, military: -GAINS.SMALL, business: GAINS.SMALL } },
    { id: 38, power: "people", accept: { treasury: -COSTS.MEDIUM, business: -GAINS.SMALL, people: GAINS.SMALL, infrastructure: GAINS.SMALL }, reject: { people: -GAINS.SMALL, business: GAINS.SMALL } },
];

// ─── Core formula helpers ─────────────────────────────────────────────────────

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

/**
 * Mirrors BudgetHandler.calculateRoundFinancials exactly.
 */
function calculateRoundFinancials({ taxes, expenditures }) {
    const { peopleTaxes, businessTaxes } = taxes;
    const { infrastructure, education, health, security } = expenditures;

    let peopleIncome   = Math.floor(INCOME.PEOPLE_BASE * (peopleTaxes / 100));
    let businessIncome = Math.floor(INCOME.BUSINESS_BASE * (businessTaxes / 100));

    if (infrastructure < 3) {
        businessIncome = Math.floor(businessIncome * 0.7);
    } else if (infrastructure > 7) {
        businessIncome = Math.floor(businessIncome * 1.1);
    }

    if (education < 3) {
        businessIncome = Math.floor(businessIncome * 0.85);
    }

    const totalIncome = peopleIncome + businessIncome;
    const expenses    = (health + infrastructure + security + education) * INCOME.EXPENDITURE_COST_PER_LEVEL;
    const netChange   = totalIncome - expenses;

    return { peopleIncome, businessIncome, totalIncome, expenses, netChange };
}

/**
 * Mirrors ActionHandler.handleDialogue threshold logic.
 * Returns { failPct, successPct, neutralPct, ev } for a given faction and charisma.
 */
function dialogueStats(power, charisma) {
    const baseSuccessRate = DIALOGUE_BASE_SUCCESS_RATE[power];
    const charismaBonus   = Math.max(-0.25, Math.min(0.25, charisma * 0.03));
    const failThreshold   = 0.1 * (1 - baseSuccessRate);
    const successThreshold = Math.max(
        failThreshold + 0.01,
        Math.min(0.95, failThreshold + baseSuccessRate * 0.7 + charismaBonus)
    );
    const failPct    = failThreshold * 100;
    const successPct = (successThreshold - failThreshold) * 100;
    const neutralPct = (1 - successThreshold) * 100;
    // EV per use: success=+1, fail=-1, neutral=0
    const ev = (successPct - failPct) / 100;
    return { failPct, successPct, neutralPct, ev };
}

// ─── 1. Treasury simulation (default settings, no events, no actions) ─────────

function section1() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('SECTION 1 — TREASURY SIMULATION (defaults, no events)');
    console.log('═══════════════════════════════════════════════════════════');

    const budget = { taxes: DEFAULT_TAXES, expenditures: DEFAULT_EXPENDITURES };
    const fin = calculateRoundFinancials(budget);

    console.log('\nDefault financials per round:');
    console.log(`  People income   : floor(${INCOME.PEOPLE_BASE} × ${DEFAULT_TAXES.peopleTaxes}/100)  = ${fin.peopleIncome}`);
    console.log(`  Business income : floor(${INCOME.BUSINESS_BASE} × ${DEFAULT_TAXES.businessTaxes}/100) = ${fin.businessIncome}`);
    console.log(`    (infra=3, edu=3 → no modifier applied)`);
    console.log(`  Total income    : ${fin.totalIncome}`);
    console.log(`  Expenses        : (${DEFAULT_EXPENDITURES.health}+${DEFAULT_EXPENDITURES.infrastructure}+${DEFAULT_EXPENDITURES.security}+${DEFAULT_EXPENDITURES.education}) × ${INCOME.EXPENDITURE_COST_PER_LEVEL} = ${fin.expenses}`);
    console.log(`  Net per round   : ${fin.netChange >= 0 ? '+' : ''}${fin.netChange}`);

    console.log('\nTreasury progression (starting 500):');
    console.log('  Round | Start | Income | Expenses | Net | End');
    console.log('  ------|-------|--------|----------|-----|-----');
    let treasury = STARTING_TREASURY;
    for (let r = 1; r <= ROUNDS.MAX; r++) {
        const start = treasury;
        treasury += fin.netChange;
        const flag = treasury <= 0 ? ' ← BANKRUPT' : '';
        console.log(`  R${String(r).padStart(2)}   | ${String(start).padStart(5)} | ${String(fin.totalIncome).padStart(6)} | ${String(fin.expenses).padStart(8)} | ${String(fin.netChange >= 0 ? '+' : '')}${fin.netChange} | ${treasury}${flag}`);
    }

    // Worst-case income: max taxes (50/50), max expenses (10 each)
    const worstBudget = {
        taxes: { peopleTaxes: 0, businessTaxes: 0 },
        expenditures: { health: 10, infrastructure: 10, security: 10, education: 10 },
    };
    const worst = calculateRoundFinancials(worstBudget);
    console.log('\nWorst-case financials (0% taxes, all expenditures at 10):');
    console.log(`  Net per round: ${worst.netChange}`);
    let worstT = STARTING_TREASURY;
    for (let r = 1; r <= ROUNDS.MAX; r++) {
        worstT += worst.netChange;
        if (worstT <= 0) {
            console.log(`  → Bankrupt after round ${r} (treasury: ${worstT})`);
            break;
        }
    }

    // When does default run out if treasury starts at 500 and income is negative?
    // Default is positive (+18), so it won't. Show what net=0 tax break-even is.
    console.log('\nBreak-even tax analysis (infra=3, edu=3, expenses=120):');
    for (let pt = 0; pt <= 50; pt += 5) {
        for (let bt = 0; bt <= 50; bt += 5) {
            const b = { taxes: { peopleTaxes: pt, businessTaxes: bt }, expenditures: DEFAULT_EXPENDITURES };
            const f = calculateRoundFinancials(b);
            if (f.netChange === 0 || (f.netChange > -5 && f.netChange < 5)) {
                if (f.netChange >= -2 && f.netChange <= 2) {
                    console.log(`  peopleTax=${pt}%, businessTax=${bt}% → net=${f.netChange >= 0 ? '+' : ''}${f.netChange}`);
                }
            }
        }
    }
}

// ─── 2. Daily event expected values ──────────────────────────────────────────

function section2() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('SECTION 2 — DAILY EVENT EXPECTED VALUES');
    console.log('═══════════════════════════════════════════════════════════');

    const powers = ['military', 'business', 'people'];
    const totalEvents = DAILY_EVENTS.length;

    // Each round exactly one event fires; it is drawn uniformly from the full list.
    // Probability that a specific event fires = 1/totalEvents.
    // But each event's "chance" field is NOT a draw weight — it is the probability
    // that the event has an effect once drawn (i.e. a severity modifier), OR it is
    // a flat draw-weight.  Looking at the game code (DailyEventHandler → getRandomDailyEvent),
    // the event is selected uniformly from the array.
    // The "chance" field is NOT used in the selection — it appears to be a design note / display value.
    // Therefore: EV per round for a faction = sum over faction's events of (mod × 1/totalEvents).

    console.log(`\nTotal event pool size: ${totalEvents}`);
    console.log('Each round one event fires drawn uniformly → P(event) = 1/' + totalEvents);
    console.log('(The "chance" field annotates severity design intent, not draw weight)\n');

    powers.forEach(power => {
        const events = DAILY_EVENTS.filter(e => e.power === power);
        const evUniform = events.reduce((sum, e) => sum + e.mod * (1 / totalEvents), 0);
        const ev10      = evUniform * 10;

        console.log(`--- ${power.toUpperCase()} (${events.length} events) ---`);
        console.log('  key                              mod  chance  P(fire)   contribution');
        events.forEach(e => {
            const p = (1 / totalEvents).toFixed(4);
            const contrib = (e.mod / totalEvents).toFixed(4);
            console.log(`  ${e.key.padEnd(35)} ${String(e.mod).padStart(3)}   ${String(e.chance).padStart(3)}%   ${p}   ${contrib}`);
        });
        console.log(`  EV per round (uniform): ${evUniform.toFixed(4)}`);
        console.log(`  Expected cumulative Δ over 10 rounds: ${ev10.toFixed(4)}\n`);
    });

    // Also show weighted-by-chance EV (treating chance/100 as true probability, sum not constrained to 1)
    // This is the alternative interpretation useful for design review.
    console.log('\nAlternative: weighted-by-chance EV (treats chance/100 as P, sum can exceed 1 — shows design intent)');
    powers.forEach(power => {
        const events = DAILY_EVENTS.filter(e => e.power === power);
        const evChance = events.reduce((sum, e) => sum + e.mod * (e.chance / 100), 0);
        console.log(`  ${power}: weighted EV per round = ${evChance.toFixed(4)} → cumulative (×10) = ${(evChance * 10).toFixed(4)}`);
    });
}

// ─── 3. Action values at various charisma levels ──────────────────────────────

function section3() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('SECTION 3 — ACTION VALUES');
    console.log('═══════════════════════════════════════════════════════════');

    const powers = ['military', 'business', 'people'];

    // --- Dialogue ---
    console.log('\nDIALOGUE at charisma 0:');
    console.log('  Faction   | fail%  | success% | neutral% | EV/use');
    console.log('  ----------|--------|----------|----------|-------');
    powers.forEach(p => {
        const s = dialogueStats(p, 0);
        console.log(`  ${p.padEnd(10)}| ${s.failPct.toFixed(2).padStart(6)} | ${s.successPct.toFixed(2).padStart(8)} | ${s.neutralPct.toFixed(2).padStart(8)} | ${s.ev.toFixed(4)}`);
    });

    // --- Bribe ---
    console.log('\nBRIBE (+3 relations guaranteed):');
    console.log('  Faction   | cost | Δrelation | cost-per-relation-point');
    console.log('  ----------|------|-----------|------------------------');
    powers.forEach(p => {
        const cost = BRIBE_COSTS[p];
        const cpp  = (cost / 3).toFixed(2);
        console.log(`  ${p.padEnd(10)}| ${String(cost).padStart(4)} | +3        | ${cpp}`);
    });
    console.log('\n  Compare: expenditure budgeting at +1/round costs 10/round for one category.');
    console.log('  Bribe is a one-shot +3 at higher per-point cost, but instant (no waiting).');

    // --- Expropriate ---
    console.log('\nEXPROPRIATE (charismaDelta = -1, relations -3):');
    console.log('  Faction   | gain | Δrelation | Δcharisma | net treasury');
    console.log('  ----------|------|-----------|-----------|-------------');
    powers.forEach(p => {
        const gain = EXPROPRIATE_GAINS[p];
        console.log(`  ${p.padEnd(10)}| ${String(gain).padStart(4)} | -3        | -1        | +${gain}`);
    });
    console.log('\n  Expropriate is costly diplomatically. A -3 relation hit takes ~3 dialogue');
    console.log('  uses at positive EV just to break even, ignoring charisma decay.');

    // --- Eliminate ---
    console.log('\nELIMINATE (charismaDelta = -2):');
    const charismaLevels = [-10, -5, 0, 5, 10];
    console.log('  charisma | backlash% | success (relation→0) | EV relation change');
    console.log('  ---------|-----------|----------------------|-------------------');
    charismaLevels.forEach(c => {
        let backlash = 0.3;
        if (c >= 5)  backlash = 0.15;
        if (c <= -5) backlash = 0.45;
        // Success: target→0 (from 0 baseline = 0 change). Backlash: another random faction -2.
        // EV of backlash relation change = backlash * (-2) spread across 2 remaining factions = -2*backlash (total)
        // Target is already at 0, so target delta = 0 (0-0).
        // If starting at a non-zero value, eliminate sets it TO 0 (clamped).
        const evRelDelta = -(2 * backlash); // expected damage to other factions
        console.log(`  ${String(c).padStart(8)} | ${(backlash * 100).toFixed(0).padStart(9)}% | reset to 0            | ${evRelDelta.toFixed(2)} to random other`);
    });
    console.log('\n  Note: -2 charisma per eliminate is severe. Two eliminates reach -4 charisma,');
    console.log('  which raises dialogue fail threshold and backlash rate considerably.');

    // Treasury comparison: expropriate business vs 4 rounds income buffer
    console.log('\nTreasury opportunity cost comparison:');
    const fin = calculateRoundFinancials({ taxes: DEFAULT_TAXES, expenditures: DEFAULT_EXPENDITURES });
    powers.forEach(p => {
        const gain = EXPROPRIATE_GAINS[p];
        const roundsEquiv = (gain / fin.netChange).toFixed(1);
        console.log(`  Expropriate ${p.padEnd(8)} (+${gain}) ≈ ${roundsEquiv} rounds of default net income (${fin.netChange >= 0 ? '+' : ''}${fin.netChange}/round)`);
    });
}

// ─── 4. Budget effects breakeven ─────────────────────────────────────────────

function section4() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('SECTION 4 — BUDGET EFFECTS BREAKEVEN');
    console.log('═══════════════════════════════════════════════════════════');

    console.log('\nSECURITY → Military relations:');
    console.log('  security < 3  → military -2/round (costs 20 income per level below 3)');
    console.log('  security 3-7  → no effect');
    console.log('  security > 7  → military +1/round');
    [1, 2, 3, 7, 8, 9, 10].forEach(lvl => {
        const cost = lvl * INCOME.EXPENDITURE_COST_PER_LEVEL;
        let effect = 'none';
        if (lvl < BUDGET_EFFECTS.SECURITY.LOW)  effect = 'military -2/round';
        if (lvl > BUDGET_EFFECTS.SECURITY.HIGH) effect = 'military +1/round';
        console.log(`  security=${lvl} → expense=${cost}/round → ${effect}`);
    });

    console.log('\nHEALTH → People relations:');
    [1, 2, 3, 7, 8].forEach(lvl => {
        const cost = lvl * INCOME.EXPENDITURE_COST_PER_LEVEL;
        let effect = 'none';
        if (lvl < BUDGET_EFFECTS.HEALTH.LOW)  effect = 'people -2/round';
        if (lvl > BUDGET_EFFECTS.HEALTH.HIGH) effect = 'people +1/round';
        console.log(`  health=${lvl} → expense=${cost}/round → ${effect}`);
    });

    console.log('\nINFRASTRUCTURE → Business + People relations + income modifier:');
    [1, 2, 3, 7, 8].forEach(lvl => {
        const cost = lvl * INCOME.EXPENDITURE_COST_PER_LEVEL;
        let relEffect = 'none';
        if (lvl < BUDGET_EFFECTS.INFRASTRUCTURE.LOW)  relEffect = 'business -1, people -1 per round';
        if (lvl > BUDGET_EFFECTS.INFRASTRUCTURE.HIGH) relEffect = 'business +1, people +1 per round';
        let incomeEffect = 'no income modifier';
        if (lvl < 3) incomeEffect = 'business income ×0.70 (-30%)';
        if (lvl > 7) incomeEffect = 'business income ×1.10 (+10%)';
        console.log(`  infra=${lvl} → expense=${cost}/round → relations: ${relEffect} | income: ${incomeEffect}`);
    });

    console.log('\nBREAKEVEN ANALYSIS for security at level 8 (military +1/round):');
    const defaultBudget = { taxes: DEFAULT_TAXES, expenditures: DEFAULT_EXPENDITURES };
    const upgradedBudget = { taxes: DEFAULT_TAXES, expenditures: { ...DEFAULT_EXPENDITURES, security: 8 } };
    const defaultFin = calculateRoundFinancials(defaultBudget);
    const upgradedFin = calculateRoundFinancials(upgradedBudget);
    const extraCost = upgradedFin.expenses - defaultFin.expenses;
    console.log(`  Default  expenses: ${defaultFin.expenses}/round,  net: ${defaultFin.netChange}`);
    console.log(`  Upgraded expenses: ${upgradedFin.expenses}/round,  net: ${upgradedFin.netChange}`);
    console.log(`  Extra cost: +${extraCost}/round for +1 military relation/round`);
    console.log(`  CAUTION: security=8 puts budget into the RED (net: ${upgradedFin.netChange}/round).`);
    console.log(`  The +1 military/round bonus costs +${extraCost}/round extra vs default settings.`);
    console.log(`  Break-even vs bribe: ${(BRIBE_COSTS.military / extraCost).toFixed(2)} rounds of drain to "save" one bribe (${BRIBE_COSTS.military}) — not viable unless treasury can absorb ~${-upgradedFin.netChange * 10} over 10 rounds.`);
}

// ─── 5. Charisma impact on dialogue ──────────────────────────────────────────

function section5() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('SECTION 5 — CHARISMA IMPACT ON DIALOGUE');
    console.log('═══════════════════════════════════════════════════════════');

    const testCharisma = [-10, -5, 0, 5, 10];
    const powers = ['military', 'business', 'people'];

    powers.forEach(power => {
        console.log(`\n  ${power.toUpperCase()} (base success rate: ${DIALOGUE_BASE_SUCCESS_RATE[power]})`);
        console.log('  charisma | charismaBonus | failThresh | successThresh | fail%  | success% | neutral% | EV');
        console.log('  ---------|---------------|------------|---------------|--------|----------|----------|-----');
        testCharisma.forEach(c => {
            const s = dialogueStats(power, c);
            const base = DIALOGUE_BASE_SUCCESS_RATE[power];
            const bonus = Math.max(-0.25, Math.min(0.25, c * 0.03));
            const failT = 0.1 * (1 - base);
            const succT = Math.max(failT + 0.01, Math.min(0.95, failT + base * 0.7 + bonus));
            console.log(`  ${String(c).padStart(8)} | ${bonus.toFixed(4).padStart(13)} | ${failT.toFixed(4).padStart(10)} | ${succT.toFixed(4).padStart(13)} | ${s.failPct.toFixed(2).padStart(6)} | ${s.successPct.toFixed(2).padStart(8)} | ${s.neutralPct.toFixed(2).padStart(8)} | ${s.ev.toFixed(4)}`);
        });
    });
}

// ─── 6. Starting balance verdict ─────────────────────────────────────────────

function section6() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('SECTION 6 — STARTING BALANCE VERDICT');
    console.log('═══════════════════════════════════════════════════════════');

    const fin = calculateRoundFinancials({ taxes: DEFAULT_TAXES, expenditures: DEFAULT_EXPENDITURES });
    console.log(`\nDefault net income: +${fin.netChange}/round`);
    console.log(`Starting treasury: ${STARTING_TREASURY}`);
    console.log(`After 10 rounds (no events): ${STARTING_TREASURY + fin.netChange * 10}`);

    // Worst-case: player expropriates all (business every round for max treasury gain)
    // but this is a one-action-per-round system, so worst financial is zero-income scenario
    console.log('\nWORST-CASE SCENARIOS:');

    // Scenario A: Player sets taxes to 0, keeps expenses at max
    const scenA = { taxes: { peopleTaxes: 0, businessTaxes: 0 }, expenditures: { health: 10, infrastructure: 10, security: 10, education: 10 } };
    const finA = calculateRoundFinancials(scenA);
    console.log(`\nScenario A — 0% taxes, all expenditures at max (10):`);
    console.log(`  Net/round: ${finA.netChange}`);
    let tA = STARTING_TREASURY;
    for (let r = 1; r <= ROUNDS.MAX; r++) {
        tA += finA.netChange;
        if (tA <= 0) { console.log(`  Bankrupt after round ${r} (treasury: ${tA})`); break; }
    }

    // Scenario B: Default taxes, keeps all at 1
    const scenB = { taxes: DEFAULT_TAXES, expenditures: { health: 1, infrastructure: 1, security: 1, education: 1 } };
    const finB = calculateRoundFinancials(scenB);
    console.log(`\nScenario B — default taxes, all expenditures at 1 (triggers all low-budget penalties):`);
    console.log(`  Net/round: +${finB.netChange}`);
    console.log(`  (financially rich but takes -2 military, -2 people, -1 business, -1 people = severe relation drain)`);

    // Scenario C: Player expropriates every round (business, best gain)
    // Each expropriate: +120 treasury, -3 business relation, -1 charisma
    console.log('\nScenario C — expropriate business every round for 10 rounds:');
    let tC = STARTING_TREASURY;
    let relC = 0; // business relation
    let chaC = 0; // charisma
    for (let r = 1; r <= ROUNDS.MAX; r++) {
        tC += fin.netChange; // normal income still applies
        tC += EXPROPRIATE_GAINS.business;
        relC = clamp(relC - 3, RELATIONS.MIN, RELATIONS.MAX);
        chaC = clamp(chaC - 1, CHARISMA.MIN, CHARISMA.MAX);
        if (relC <= RELATIONS.MIN) { console.log(`  Business overthrows at round ${r} (relation: ${relC})`); break; }
    }
    console.log(`  After 10 rounds: treasury ${tC}, business relation ${relC}, charisma ${chaC}`);

    // Scenario D: Spends every bribe (business) every round — most expensive action
    console.log('\nScenario D — bribe business every round (cost 80):');
    let tD = STARTING_TREASURY;
    for (let r = 1; r <= ROUNDS.MAX; r++) {
        tD += fin.netChange;
        tD -= BRIBE_COSTS.business;
        if (tD <= 0) { console.log(`  Bankrupt after round ${r} (treasury: ${tD})`); break; }
        if (r === ROUNDS.MAX) console.log(`  Survives 10 rounds, treasury: ${tD}`);
    }

    // Summary: net income safety buffer
    const minSafeNet = -STARTING_TREASURY / ROUNDS.MAX;
    console.log(`\nSAFETY BUFFER SUMMARY:`);
    console.log(`  Default net: +${fin.netChange}/round is POSITIVE — treasury grows, no survival risk from budget alone`);
    console.log(`  Break-even requires net ≥ 0 (currently +${fin.netChange})`);
    console.log(`  To go bankrupt in 10 rounds from default: need net < ${Math.ceil(minSafeNet)}/round (i.e. net < -50/round)`);
    console.log(`  This requires taxes near 0% AND expenses at maximum simultaneously`);
    console.log(`  Tax threshold triggers at people>30 or business>45 → charisma/relation drain per round`);
    console.log(`  Default business tax (40%) is BELOW business threshold (45%) — no penalty at defaults`);
    console.log(`  Default people tax (30%) is AT the threshold (>30 triggers penalty) — NOT triggered at exactly 30`);
}

// ─── 7. Deal treasury analysis ────────────────────────────────────────────────

function section7() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('SECTION 7 — DEAL TREASURY EFFECTS SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');

    const withTreasury = DEALS.filter(d => d.acceptEffect.treasury !== undefined);
    const positive = withTreasury.filter(d => d.acceptEffect.treasury > 0).sort((a, b) => b.acceptEffect.treasury - a.acceptEffect.treasury);
    const negative = withTreasury.filter(d => d.acceptEffect.treasury < 0).sort((a, b) => a.acceptEffect.treasury - b.acceptEffect.treasury);

    console.log('\nPositive treasury deals (accept):');
    positive.forEach(d => console.log(`  Deal ${String(d.id).padStart(2)}: +${d.acceptEffect.treasury} treasury | relations: ${JSON.stringify(Object.fromEntries(Object.entries(d.acceptEffect).filter(([k]) => ['military','business','people'].includes(k))))}`));

    console.log('\nNegative treasury deals (accept):');
    negative.forEach(d => console.log(`  Deal ${String(d.id).padStart(2)}: ${d.acceptEffect.treasury} treasury | relations: ${JSON.stringify(Object.fromEntries(Object.entries(d.acceptEffect).filter(([k]) => ['military','business','people'].includes(k))))}`));

    const fin = calculateRoundFinancials({ taxes: DEFAULT_TAXES, expenditures: DEFAULT_EXPENDITURES });
    console.log(`\nAll treasury effects as multiples of default net income (${fin.netChange}/round):`);
    withTreasury.forEach(d => {
        const t = d.acceptEffect.treasury;
        const rounds = (t / fin.netChange).toFixed(1);
        const sign = t > 0 ? '+' : '';
        console.log(`  Deal ${String(d.id).padStart(2)}: ${sign}${t} ≈ ${rounds} rounds of income`);
    });
}

// ─── 8. Law treasury costs by power ──────────────────────────────────────────

function section8() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('SECTION 8 — LAW TREASURY COSTS BY POWER TYPE');
    console.log('═══════════════════════════════════════════════════════════');

    ['military', 'business', 'people'].forEach(power => {
        const laws = LAWS.filter(l => l.power === power);
        const withCost = laws.filter(l => l.accept.treasury !== undefined);
        const costs = withCost.map(l => l.accept.treasury);
        const avg = costs.reduce((a, b) => a + b, 0) / (costs.length || 1);
        const pos = costs.filter(c => c > 0);
        const neg = costs.filter(c => c < 0);

        console.log(`\n  ${power.toUpperCase()} laws (${laws.length} total, ${withCost.length} with treasury effect):`);
        console.log(`    Treasury costs on accept: [${costs.join(', ')}]`);
        console.log(`    Average treasury impact:  ${avg.toFixed(1)}`);
        console.log(`    Positive (gains): ${pos.length} laws, values: [${pos.join(', ')}]`);
        console.log(`    Negative (costs): ${neg.length} laws, values: [${neg.join(', ')}]`);
    });
}

// ─── Run all sections ─────────────────────────────────────────────────────────

section1();
section2();
section3();
section4();
section5();
section6();
section7();
section8();

console.log('\n═══════════════════════════════════════════════════════════');
console.log('END OF BALANCE REPORT');
console.log('═══════════════════════════════════════════════════════════\n');
