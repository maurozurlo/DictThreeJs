// Game State
let gameState = {
    round: 1,
    treasury: 500,
    relations: {
        military: 0,
        business: 0,
        people: 0
    },
    budget: {
        health: 1,
        infrastructure: 1,
        security: 1,
        education: 1
    },
    taxes: {
        people: 20,
        business: 30
    },
    gamePhase: 'event', // event -> law -> action -> resolution
    currentLaw: null,
    actionTaken: false,
    lawDecided: false
};

// Laws database
const laws = {
    military: [
        { text: "Increase military spending by 50%", effect: "Boost security budget requirement" },
        { text: "Implement martial law in troubled regions", effect: "Reduce people relation, increase security" },
        { text: "Expand military recruitment program", effect: "Increase military relation, costs money" },
        { text: "Conduct joint exercises with allied nations", effect: "Increase military relation, minor cost" },
        { text: "Modernize military equipment", effect: "Boost security, high cost" },
        { text: "Introduce mandatory military training in schools", effect: "Increase military relation, reduce people relation" },
        { text: "Strengthen border defenses", effect: "Increase military relation, infrastructure cost" },
        { text: "Launch intelligence reforms", effect: "Increase military relation, moderate cost" },
        { text: "Increase military salaries", effect: "Boost military relation, reduces treasury" },
        { text: "Implement stricter military hierarchy", effect: "Boost military relation, minor people unrest" },
        { text: "Promote veterans programs", effect: "Increase military relation, small budget" },
        { text: "Deploy troops to international missions", effect: "Military prestige up, costs money" },
        { text: "Expand naval fleet", effect: "Increase security, high cost" }
    ],
    business: [
        { text: "Cut corporate tax rates by 10%", effect: "Reduce business tax income" },
        { text: "Deregulate key industries", effect: "Improve business relations, risk to people" },
        { text: "Establish free trade zones", effect: "Increase business income, infrastructure costs" },
        { text: "Subsidize major industries", effect: "Boost business relation, costs treasury" },
        { text: "Introduce business-friendly labor laws", effect: "Improve business relation, reduce people satisfaction" },
        { text: "Provide tax holidays for startups", effect: "Boost business innovation, reduce tax income" },
        { text: "Encourage foreign investment", effect: "Increase business income, moderate cost" },
        { text: "Privatize state-owned companies", effect: "Increase business relation, reduce government control" },
        { text: "Offer export incentives", effect: "Boost business income, costs treasury" },
        { text: "Reduce import tariffs", effect: "Improve business relation, reduce treasury" },
        { text: "Simplify corporate licensing", effect: "Increase business relation, minor cost" },
        { text: "Promote tech hubs and innovation zones", effect: "Boost business relation, infrastructure costs" },
        { text: "Implement flexible working regulations", effect: "Increase business satisfaction, reduce people relation" }
    ],
    people: [
        { text: "Increase minimum wage by 25%", effect: "Improve people relation, worsen business relation" },
        { text: "Expand free healthcare coverage", effect: "Increase health budget requirement" },
        { text: "Implement universal basic education", effect: "Increase education budget requirement" },
        { text: "Provide housing subsidies", effect: "Boost people relation, costs treasury" },
        { text: "Introduce unemployment benefits", effect: "Increase people relation, moderate cost" },
        { text: "Launch food security programs", effect: "Improve people relation, costs treasury" },
        { text: "Implement progressive tax on wealthy", effect: "Increase people satisfaction, reduce business relation" },
        { text: "Expand public transport access", effect: "Boost people relation, infrastructure cost" },
        { text: "Enforce workplace safety regulations", effect: "Improve people relation, minor business pushback" },
        { text: "Subsidize cultural and sports programs", effect: "Increase people satisfaction, small cost" },
        { text: "Provide childcare support", effect: "Boost people relation, moderate cost" },
        { text: "Expand pension schemes", effect: "Improve people relation, reduces treasury" },
        { text: "Implement renewable energy projects", effect: "People happy, costs treasury, may upset business" }
    ]
};

const luckyEvents = [
    "A military hero publicly praises your leadership.",
    "Business elites enjoy a sudden surge in profits thanks to your policies.",
    "People celebrate a new national holiday you introduced.",
    "A foreign delegation compliments your governance.",
    "A successful infrastructure project wins public approval.",
    "Media outlets report positive news about your regime."
];

// Random events
const randomEvents = [
    "Economic uncertainty causes unrest among the people.",
    "Military leaders express concerns about regional stability.",
    "Business elites worry about government interference.",
    "International sanctions affect the economy.",
    "Labor strikes break out in major cities.",
    "Military exercises near the border cause tension.",
    "Corruption scandal emerges in government circles.",
    "Natural disaster requires emergency response.",
    "Opposition groups stage peaceful protests.",
    "Regional conflicts affect trade relationships.",
    "A major cyber attack disrupts government infrastructure.",
    "Inflation spikes, causing public dissatisfaction.",
    "Foreign investors withdraw funds suddenly.",
    "Smuggling networks are exposed, causing public outrage.",
    "Media leaks reveal secret government operations.",
    "A popular politician gains unexpected support.",
    "Religious groups mobilize against recent policies.",
    "Critical infrastructure suffers unexpected failures.",
    "A health epidemic spreads in urban areas.",
    "New technology regulations anger business leaders.",
    "A military coup attempt is narrowly avoided.",
    "International aid is delayed due to diplomatic tensions.",
    "Public transport strikes affect the daily lives of citizens.",
    "Environmental protests disrupt major industrial regions.",
    "A scandal involving a high-ranking official surfaces."
];

// Mini-challenges
const miniChallenges = [
    {
        text: "A foreign spy offers you classified intelligence in exchange for $50M. Accept the deal?",
        acceptText: "You accepted the spy's offer. Gained valuable intelligence but risked exposure.",
        rejectText: "You rejected the spy's offer. Played it safe but missed potential advantage.",
        acceptEffect: { treasury: -50, military: 2, risk: 0.3 }, // 30% chance of backlash
        rejectEffect: { military: 1 },
        riskText: "The intelligence was a trap! Foreign relations suffer."
    },
    {
        text: "A wealthy businessman offers you a $80M 'donation' for favorable policies. Accept?",
        acceptText: "You accepted the businessman's donation. Treasury boosted but ethics questioned.",
        rejectText: "You rejected the bribe. Maintained integrity but missed financial opportunity.",
        acceptEffect: { treasury: 80, business: 1, people: -2 },
        rejectEffect: { people: 1, business: -1 }
    },
    {
        text: "Intelligence reports suggest a rival is planning against you. Spend $40M on counter-intelligence?",
        acceptText: "You invested in counter-intelligence. Potential threats neutralized.",
        rejectText: "You chose not to investigate. Saved money but remained vulnerable.",
        acceptEffect: { treasury: -40, military: 1 },
        rejectEffect: { risk: 0.2 }, // 20% chance of relation damage
        riskText: "Your rival successfully undermined your position with the military!"
    },
    {
        text: "A popular celebrity wants to endorse your regime for $30M. Worth the investment?",
        acceptText: "You hired the celebrity endorsement. Public image improved significantly.",
        rejectText: "You declined the celebrity deal. Saved money but missed PR opportunity.",
        acceptEffect: { treasury: -30, people: 2 },
        rejectEffect: { people: 0 }
    },
    {
        text: "Black market arms dealers offer you military equipment for $60M. Make the deal?",
        acceptText: "You purchased black market weapons. Military strength increased but reputation damaged.",
        rejectText: "You refused the illegal arms deal. Maintained legitimacy but missed military advantage.",
        acceptEffect: { treasury: -60, military: 2, people: -1 },
        rejectEffect: { people: 1 }
    }
];

// Periodic events (every 3 rounds)
const periodicEvents = [
    {
        round: 3,
        title: "International Summit",
        text: "World leaders are watching your performance. Choose your approach:",
        options: [
            {
                text: "Host lavish summit ($100M)",
                effect: { treasury: -100, military: 1, business: 1, people: -1 },
                result: "The summit was impressive but expensive. International prestige gained."
            },
            {
                text: "Modest diplomatic meeting ($30M)",
                effect: { treasury: -30, military: 0, business: 0, people: 1 },
                result: "A reasonable diplomatic approach. Modest costs, modest gains."
            },
            {
                text: "Skip the summit (Free)",
                effect: { treasury: 0, military: -1, business: -1, people: 0 },
                result: "You avoided the summit. Saved money but damaged international relations."
            }
        ]
    },
    {
        round: 6,
        title: "Economic Crisis",
        text: "A financial crisis hits the nation. How do you respond?",
        options: [
            {
                text: "Massive stimulus package ($150M)",
                effect: { treasury: -150, business: 3, people: 2, military: 0 },
                result: "The stimulus worked! Economy stabilized and public confidence restored."
            },
            {
                text: "Targeted business bailouts ($80M)",
                effect: { treasury: -80, business: 2, people: -1, military: 0 },
                result: "Businesses recovered but people felt abandoned during the crisis."
            },
            {
                text: "Let market forces decide (Free)",
                effect: { treasury: 0, business: -2, people: -2, military: 1 },
                result: "The crisis deepened. Only the military appreciated your 'tough' stance."
            }
        ]
    },
    {
        round: 9,
        title: "Natural Disaster",
        text: "A major earthquake strikes the capital. Emergency response needed:",
        options: [
            {
                text: "Full emergency response ($120M)",
                effect: { treasury: -120, people: 3, military: 1, business: 0 },
                result: "Swift response saved lives. The people are grateful for your leadership."
            },
            {
                text: "Basic relief efforts ($50M)",
                effect: { treasury: -50, people: 1, military: 0, business: 0 },
                result: "Adequate response provided. Situation managed without major issues."
            },
            {
                text: "Minimal intervention ($10M)",
                effect: { treasury: -10, people: -3, military: -1, business: 1 },
                result: "Poor response caused suffering. Only businesses benefited from reduced spending."
            }
        ]
    }
];

// Current challenge and periodic event state
let currentChallenge = null;
let currentPeriodicEvent = null;

// Initialize game
function initGame() {
    updateUI();
    startRound();
}

// Start a new round
function startRound() {
    if (gameState.round > 10) {
        showVictory();
        return;
    }

    gameState.gamePhase = 'event';
    gameState.actionTaken = false;
    gameState.lawDecided = false;
    currentChallenge = null;
    currentPeriodicEvent = null;

    // Check for periodic events first
    const periodicEvent = periodicEvents.find(event => event.round === gameState.round);
    if (periodicEvent) {
        currentPeriodicEvent = periodicEvent;
        showPeriodicEvent();
        return;
    }

    // 40% chance for mini-challenge
    if (Math.random() < 0.4) {
        currentChallenge = miniChallenges[Math.floor(Math.random() * miniChallenges.length)];
        showMiniChallenge();
        return;
    }

    // Regular round start
    startRegularRound();
}

function startRegularRound() {
    // Random event - may increase or decrease relation
    const powers = ['military', 'business', 'people'];
    const isLucky = Math.random() < 0.3; // 30% chance for a lucky event
    let affectedPower = powers[Math.floor(Math.random() * powers.length)];
    let change;

    if (isLucky) {
        change = Math.floor(Math.random() * 3) + 1; // +1 to +3
        gameState.relations[affectedPower] = Math.min(10, gameState.relations[affectedPower] + change);
        const luckyText = luckyEvents[Math.floor(Math.random() * luckyEvents.length)];
        document.getElementById('event-text').textContent = `${luckyText} (${affectedPower} relation +${change})`;
    } else {
        change = Math.floor(Math.random() * 3) + 1; // 1-3
        gameState.relations[affectedPower] = Math.max(-10, gameState.relations[affectedPower] - change);
        const eventText = randomEvents[Math.floor(Math.random() * randomEvents.length)];
        document.getElementById('event-text').textContent = `${eventText} (${affectedPower} relation -${change})`;
    }

    // Generate law proposal
    const lawPower = powers[Math.floor(Math.random() * powers.length)];
    gameState.currentLaw = {
        proposer: lawPower,
        ...laws[lawPower][Math.floor(Math.random() * laws[lawPower].length)]
    };

    document.getElementById('law-text').textContent =
        `The ${gameState.currentLaw.proposer} proposes: "${gameState.currentLaw.text}"`;

    // Show appropriate UI sections
    document.getElementById('round-event').style.display = 'block';
    document.getElementById('law-panel').style.display = 'block';
    document.getElementById('challenge-panel').style.display = 'none';
    document.getElementById('periodic-event-panel').style.display = 'none';
    document.getElementById('power-actions').style.display = 'none';
    document.getElementById('action-results').classList.add('hidden');

    // Re-enable law buttons for new round
    document.getElementById('approve-law').disabled = false;
    document.getElementById('reject-law').disabled = false;

    // Re-enable action buttons for new round
    const actionButtons = document.querySelectorAll('.power-group button');
    actionButtons.forEach(button => button.disabled = false);
    updateUI();
}

// Show mini-challenge
function showMiniChallenge() {
    document.getElementById('challenge-text').textContent = currentChallenge.text;

    // Hide other panels
    document.getElementById('round-event').style.display = 'none';
    document.getElementById('law-panel').style.display = 'none';
    document.getElementById('periodic-event-panel').style.display = 'none';
    document.getElementById('power-actions').style.display = 'none';
    document.getElementById('action-results').classList.add('hidden');

    // Show challenge panel
    document.getElementById('challenge-panel').style.display = 'block';

    updateUI();
}

// Handle challenge decision
function handleChallenge(accepted) {
    const challenge = currentChallenge;
    let resultText = accepted ? challenge.acceptText : challenge.rejectText;
    let effect = accepted ? challenge.acceptEffect : challenge.rejectEffect;

    // Apply effects
    if (effect.treasury) gameState.treasury += effect.treasury;
    if (effect.military) gameState.relations.military = Math.max(-10, Math.min(10, gameState.relations.military + effect.military));
    if (effect.business) gameState.relations.business = Math.max(-10, Math.min(10, gameState.relations.business + effect.business));
    if (effect.people) gameState.relations.people = Math.max(-10, Math.min(10, gameState.relations.people + effect.people));

    // Handle risk
    if (effect.risk && Math.random() < effect.risk) {
        resultText += " " + challenge.riskText;
        if (accepted && challenge.acceptEffect.military) {
            gameState.relations.military = Math.max(-10, gameState.relations.military - 2);
        } else if (!accepted) {
            // Risk for rejection - random power gets angry
            const powers = ['military', 'business', 'people'];
            const angryPower = powers[Math.floor(Math.random() * powers.length)];
            gameState.relations[angryPower] = Math.max(-10, gameState.relations[angryPower] - 1);
        }
    }

    document.getElementById('challenge-result').textContent = resultText;
    document.getElementById('challenge-panel').style.display = 'none';
    document.getElementById('challenge-result-panel').style.display = 'block';

    updateUI();

    // Check for game over
    if (checkGameOver()) return;
}

// Continue from challenge to regular round
function continueFromChallenge() {
    document.getElementById('challenge-result-panel').style.display = 'none';
    startRegularRound();
}

// Show periodic event
function showPeriodicEvent() {
    document.getElementById('periodic-title').textContent = currentPeriodicEvent.title;
    document.getElementById('periodic-text').textContent = currentPeriodicEvent.text;

    // Create option buttons
    const optionsContainer = document.getElementById('periodic-options');
    optionsContainer.innerHTML = '';

    currentPeriodicEvent.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.textContent = option.text;
        button.onclick = () => handlePeriodicEvent(index);
        optionsContainer.appendChild(button);
    });

    // Hide other panels
    document.getElementById('round-event').style.display = 'none';
    document.getElementById('law-panel').style.display = 'none';
    document.getElementById('challenge-panel').style.display = 'none';
    document.getElementById('power-actions').style.display = 'none';
    document.getElementById('action-results').classList.add('hidden');

    // Show periodic event panel
    document.getElementById('periodic-event-panel').style.display = 'block';

    updateUI();
}

// Handle periodic event decision
function handlePeriodicEvent(optionIndex) {
    const option = currentPeriodicEvent.options[optionIndex];

    // Apply effects
    if (option.effect.treasury) gameState.treasury += option.effect.treasury;
    if (option.effect.military) gameState.relations.military = Math.max(-10, Math.min(10, gameState.relations.military + option.effect.military));
    if (option.effect.business) gameState.relations.business = Math.max(-10, Math.min(10, gameState.relations.business + option.effect.business));
    if (option.effect.people) gameState.relations.people = Math.max(-10, Math.min(10, gameState.relations.people + option.effect.people));

    document.getElementById('periodic-result').textContent = option.result;
    document.getElementById('periodic-event-panel').style.display = 'none';
    document.getElementById('periodic-result-panel').style.display = 'block';

    updateUI();

    // Check for game over
    if (checkGameOver()) return;
}

// Continue from periodic event to regular round
function continueFromPeriodicEvent() {
    document.getElementById('periodic-result-panel').style.display = 'none';
    startRegularRound();
}

// Handle law decision
function decideLaw(approved) {
    if (gameState.lawDecided) return;

    gameState.lawDecided = true;
    const proposer = gameState.currentLaw.proposer;

    if (approved) {
        // Improve relation with proposer
        gameState.relations[proposer] = Math.min(10, gameState.relations[proposer] + 2);

        // Worsen relations with others
        Object.keys(gameState.relations).forEach(power => {
            if (power !== proposer) {
                gameState.relations[power] = Math.max(-10, gameState.relations[power] - 1);
            }
        });

        // Apply law effects
        applyLawEffects(gameState.currentLaw, true);

        document.getElementById('law-text').textContent =
            `You APPROVED the law. ${proposer} relation +2, others -1`;
    } else {
        // Worsen relation with proposer
        gameState.relations[proposer] = Math.max(-10, gameState.relations[proposer] - 2);

        // Slightly improve relations with others
        Object.keys(gameState.relations).forEach(power => {
            if (power !== proposer) {
                gameState.relations[power] = Math.min(10, gameState.relations[power] + 1);
            }
        });

        document.getElementById('law-text').textContent =
            `You REJECTED the law. ${proposer} relation -2, others +1`;
    }

    // Hide law buttons and show power actions
    document.getElementById('law-panel').style.display = 'none';
    document.getElementById('power-actions').style.display = 'block';

    updateUI();

    // Check for game over
    if (checkGameOver()) return;
}

// Apply law effects
function applyLawEffects(law, approved) {
    if (!approved) return;

    // Simple implementation - some laws affect budget or taxes
    if (law.text.includes("corporate tax")) {
        gameState.taxes.business = Math.max(15, gameState.taxes.business - 10);
    } else if (law.text.includes("military spending")) {
        gameState.budget.security = Math.min(10, gameState.budget.security + 2);
    } else if (law.text.includes("healthcare")) {
        gameState.budget.health = Math.min(10, gameState.budget.health + 1);
    } else if (law.text.includes("education")) {
        gameState.budget.education = Math.min(10, gameState.budget.education + 1);
    }
}

// Perform power action
function performAction(power, action) {
    if (gameState.actionTaken) return;

    gameState.actionTaken = true;
    let resultText = "";

    switch (action) {
        case 'bribe':
            const bribeCost = power === 'business' ? 80 : power === 'military' ? 60 : 40;
            if (gameState.treasury >= bribeCost) {
                gameState.treasury -= bribeCost;
                gameState.relations[power] = Math.min(10, gameState.relations[power] + 3);
                resultText = `You bribed the ${power}. Relation +3, Treasury -$${bribeCost}M`;
            } else {
                resultText = `Insufficient funds for bribery. Action failed.`;
                gameState.actionTaken = false;
                return;
            }
            break;

        case 'eliminate':
            const risk = Math.random() < 0.3; // 30% chance of backlash
            gameState.relations[power] = 0;
            if (risk) {
                // Random other power gets angry
                const otherPowers = Object.keys(gameState.relations).filter(p => p !== power);
                const angryPower = otherPowers[Math.floor(Math.random() * otherPowers.length)];
                gameState.relations[angryPower] = Math.max(-10, gameState.relations[angryPower] - 2);
                resultText = `You eliminated ${power} leadership. ${power} reset to neutral, ${angryPower} relation -2 (backlash)`;
            } else {
                resultText = `You eliminated ${power} leadership. ${power} relation reset to neutral.`;
            }
            break;

        case 'expropriate':
            const expropriationGain = power === 'business' ? 120 : power === 'military' ? 80 : 30;
            gameState.treasury += expropriationGain;
            gameState.relations[power] = Math.max(-10, gameState.relations[power] - 3);
            resultText = `You expropriated assets from ${power}. Treasury +$${expropriationGain}M, relation -3`;
            break;

        case 'dialogue':
            const rand = Math.random();
            if (rand < 0.1) { // 10% chance to go terribly wrong
                gameState.relations[power] = Math.max(-10, gameState.relations[power] - 1);
                resultText = `Dialogue with ${power} went terribly wrong! Relation -1`;
            } else if (rand < 0.7) { // next 60% chance for normal success
                gameState.relations[power] = Math.min(10, gameState.relations[power] + 1);
                resultText = `Successful dialogue with ${power}. Relation +1`;
            } else { // remaining 30% chance, no change
                resultText = `Dialogue with ${power} failed. No change.`;
            }
            break;
    }

    // Show results
    document.getElementById('action-text').textContent = resultText;
    document.getElementById('power-actions').style.display = 'none';
    document.getElementById('action-results').classList.remove('hidden');

    updateUI();

    // Check for game over
    checkGameOver();
}

// Move to next round
function nextRound() {
    // Round resolution - collect taxes
    let peopleIncome = Math.floor(200 * (gameState.taxes.people / 100));
    let businessIncome = Math.floor(150 * (gameState.taxes.business / 100));

    // Adjust income based on budget
    // Poor infrastructure reduces business tax effectiveness
    if (gameState.budget.infrastructure < 3) {
        businessIncome = Math.floor(businessIncome * 0.7); // 30% loss
    } else if (gameState.budget.infrastructure > 7) {
        businessIncome = Math.floor(businessIncome * 1.1); // 10% bonus
    }

    // Poor education reduces future business support (could implement long-term later)
    if (gameState.budget.education < 3) {
        businessIncome = Math.floor(businessIncome * 0.85);
    }

    // Poor security risks military backlash
    if (gameState.budget.security < 3) {
        gameState.relations.military = Math.max(-10, gameState.relations.military - 2);
        addRoundMessage("Military complains about underfunding! Military relation -2");
    } else if (gameState.budget.security > 7) {
        gameState.relations.military = Math.min(10, gameState.relations.military + 1);
        addRoundMessage("Military feels well-funded! Military relation +1");
    }

    // Poor health reduces people support
    if (gameState.budget.health < 3) {
        gameState.relations.people = Math.max(-10, gameState.relations.people - 2);
        addRoundMessage("Health services are failing! People relation -2");
    } else if (gameState.budget.health > 7) {
        gameState.relations.people = Math.min(10, gameState.relations.people + 1);
        addRoundMessage("Health system praised! People relation +1");
    }

    // Poor infrastructure reduces people and business satisfaction
    if (gameState.budget.infrastructure < 3) {
        gameState.relations.business = Math.max(-10, gameState.relations.business - 1);
        gameState.relations.people = Math.max(-10, gameState.relations.people - 1);
        addRoundMessage("Infrastructure failing! People & Business relation -1");
    } else if (gameState.budget.infrastructure > 7) {
        gameState.relations.business = Math.min(10, gameState.relations.business + 1);
        gameState.relations.people = Math.min(10, gameState.relations.people + 1);
        addRoundMessage("Infrastructure praised! People & Business relation +1");
    }

    // Calculate total income and expenses
    const totalIncome = peopleIncome + businessIncome;
    const expenses = (gameState.budget.health + gameState.budget.infrastructure +
        gameState.budget.security + gameState.budget.education) * 25;

    gameState.treasury += totalIncome - expenses;

    console.log('e')
    addRoundMessage(`Collected taxes: $${totalIncome}M, Paid budgets: $${expenses}M`);

    // Tax collection affects relations (optional)
    if (gameState.taxes.people > 30) {
        gameState.relations.people = Math.max(-10, gameState.relations.people - 1);
    }
    if (gameState.taxes.business > 45) {
        gameState.relations.business = Math.max(-10, gameState.relations.business - 1);
    }

    gameState.round++;

    // Check for game over after financial/budget resolution
    if (checkGameOver()) return;

    startRound();
}

// Utility function to show messages for budget effects
function addRoundMessage(text) {
    document.getElementById('budget-text').textContent = text
}


// Update budget
function updateBudget(area, value) {
    gameState.budget[area] = parseInt(value);
    document.getElementById(`${area}-budget`).textContent = value * 25;

    const totalExpenses = (gameState.budget.health + gameState.budget.infrastructure +
        gameState.budget.security + gameState.budget.education) * 25;
    document.getElementById('total-expenses').textContent = totalExpenses;
}

// Update tax rates
function updateTax(type, value) {
    gameState.taxes[type] = parseInt(value);
    document.getElementById(`${type}-tax-rate`).textContent = value;
}

// Update UI
function updateUI() {
    // Round and treasury
    document.getElementById('current-round').textContent = gameState.round;
    document.getElementById('treasury').textContent = gameState.treasury;

    // Relations
    Object.keys(gameState.relations).forEach(power => {
        const value = gameState.relations[power];
        document.getElementById(`${power}-value`).textContent = value;

        // Update relation bar
        const bar = document.getElementById(`${power}-bar`);
        const percentage = ((value + 10) / 20) * 100; // Convert -10 to +10 range to 0-100%

        if (value > 5) {
            bar.style.background = '#27ae60'; // Green for good relations
        } else if (value < -5) {
            bar.style.background = '#e74c3c'; // Red for bad relations
        } else {
            bar.style.background = '#f39c12'; // Orange for neutral
        }

        bar.style.width = percentage + '%';
    });

    // Budget sliders
    Object.keys(gameState.budget).forEach(area => {
        document.getElementById(`${area}-slider`).value = gameState.budget[area];
        document.getElementById(`${area}-budget`).textContent = gameState.budget[area] * 25;
    });

    // Tax sliders
    Object.keys(gameState.taxes).forEach(type => {
        document.getElementById(`${type}-tax-slider`).value = gameState.taxes[type];
        document.getElementById(`${type}-tax-rate`).textContent = gameState.taxes[type];
    });

    // Total expenses
    const totalExpenses = (gameState.budget.health + gameState.budget.infrastructure +
        gameState.budget.security + gameState.budget.education) * 25;
    document.getElementById('total-expenses').textContent = totalExpenses;

    // Disable action buttons if already taken
    if (gameState.actionTaken) {
        const actionButtons = document.querySelectorAll('.power-group button');
        actionButtons.forEach(button => button.disabled = true);
    }

    // Disable law buttons if already decided
    if (gameState.lawDecided) {
        document.getElementById('approve-law').disabled = true;
        document.getElementById('reject-law').disabled = true;
    }
}

// Check for game over conditions
function checkGameOver() {
    // Check relations
    for (const power of Object.keys(gameState.relations)) {
        if (gameState.relations[power] <= -10) {
            showGameOver(`The ${power} has overthrown your government! Relations dropped to -10.`);
            return true;
        }
    }

    // Check treasury
    if (gameState.treasury <= 0) {
        showGameOver('Economic collapse! Your treasury has run out of funds.');
        return true;
    }

    return false;
}

// Show game over screen
function showGameOver(reason) {
    document.getElementById('game-over-reason').textContent = reason;
    document.getElementById('final-stats').textContent =
        `You survived ${gameState.round - 1} rounds. Final treasury: $${gameState.treasury}M`;
    document.getElementById('game-over').classList.remove('hidden');
}

// Show victory screen
function showVictory() {
    document.getElementById('victory-stats').textContent =
        `Final treasury: $${gameState.treasury}M. Relations - Military: ${gameState.relations.military}, Business: ${gameState.relations.business}, People: ${gameState.relations.people}`;
    document.getElementById('victory').classList.remove('hidden');
}

// Start new game
function startNewGame() {
    // Reset game state
    gameState = {
        round: 1,
        treasury: 500,
        relations: {
            military: 0,
            business: 0,
            people: 0
        },
        budget: {
            health: 1,
            infrastructure: 1,
            security: 1,
            education: 1
        },
        taxes: {
            people: 20,
            business: 30
        },
        gamePhase: 'event',
        currentLaw: null,
        actionTaken: false,
        lawDecided: false
    };

    // Hide screens
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('victory').classList.add('hidden');

    // Re-enable all buttons
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach(button => button.disabled = false);

    // Reset UI and start
    updateUI();
    startRound();
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', function () {
    initGame();
});