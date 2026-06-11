/**
 * Converts the game's education budget level (1–10) to the 0–100 scale
 * expected by dumbifyText. Default value (3) maps to 100 (no dumbification).
 * Minimum value (1) maps to 0 (full chaos).
 */
export function educationToDumbScore(education: number): number {
    const MIN = 1
    const DEFAULT = 3
    return Math.min(100, Math.max(0, ((education - MIN) / (DEFAULT - MIN)) * 100))
}

export function dumbifyText(text: string, education: number) {
    if (education >= 100) return text;

    const dumbness = (100 - education) / 100;
    
    // Step 1: Pre-process punctuation based on chaos level
    if (dumbness > 0.5) {
        // Strip out periods, commas, and semicolons entirely
        text = text.replace(/[.,;]/g, "");
    }
    
    let words = text.split(" ");

    // Tier 1: Extreme Word Shuffling & Omission
    if (dumbness > 0.5) {
        let shuffledWords = [];
        for (let i = 0; i < words.length; i++) {
            // High chance to drop small words like "the", "to", "a", "is" entirely
            if (dumbness > 0.8 && ["the", "to", "a", "is", "for", "and"].includes(words[i].toLowerCase()) && Math.random() < 0.6) {
                continue; 
            }
            shuffledWords.push(words[i]);
        }
        
        // Scramble remaining word order aggressively
        for (let i = 0; i < shuffledWords.length - 1; i++) {
            if (Math.random() < (dumbness * 0.35)) {
                let temp: string = shuffledWords[i];
                shuffledWords[i] = shuffledWords[i + 1];
                shuffledWords[i + 1] = temp;
            }
        }
        words = shuffledWords;
    }

    // Process individual words
    words = words.map((word: string) => {
        let letters = word.split("");

        // Tier 2: Aggressive Letter Replacements & Deletions
        if (Math.random() < dumbness) {
            for (let i = 0; i < letters.length; i++) {
                let lower = letters[i].toLowerCase();
                
                // Swap common letters
                if (lower === 's') letters[i] = 'z';
                if (lower === 'x') letters[i] = 'gz';
                if (lower === 'c' && letters[i+1]?.toLowerCase() === 'h') {
                    letters[i] = 'k'; letters[i+1] = '';
                }
                if (lower === 't' && letters[i+1]?.toLowerCase() === 'h') {
                    letters[i] = 'd'; letters[i+1] = '';
                }
                
                // Drop letters entirely at random if super dumb
                if (dumbness > 0.8 && Math.random() < 0.15 && letters.length > 2) {
                    letters[i] = '';
                }
            }
            letters = letters.filter((l: string) => l !== ''); // Clean up dropped letters
        }

        // Tier 3: Extreme Vowel/Consonant Stretching
        if (Math.random() < (dumbness * 0.4) && letters.length > 1) {
            const targets = ['a', 'e', 'i', 'o', 'u', 'y', 'z', 'm', 'b', 'g', 'h'];
            const randIndex = Math.floor(Math.random() * letters.length);
            if (targets.includes(letters[randIndex]?.toLowerCase())) {
                // At 0 education, repeating up to 6 times
                const repeatCount = Math.floor(dumbness * 5) + 1;
                letters[randIndex] = letters[randIndex].repeat(repeatCount);
            }
        }

        // Tier 4: Total Character Scrambling
        if (Math.random() < (dumbness * 0.5) && letters.length > 2) {
            const idx = Math.floor(Math.random() * (letters.length - 1));
            let temp = letters[idx];
            letters[idx] = letters[idx + 1];
            letters[idx + 1] = temp;
        }

        return letters.join("");
    });

    let result = words.join(" ");

    // Step 2: Custom Capitalization and Punctuation Injection
    if (dumbness > 0.85) {
        // 0 Education: Absolute chaos casing (wHeRe ArE mY pAnTs)
        result = result.split("").map((char: string) => {
            return Math.random() < 0.5 ? char.toLowerCase() : char.toUpperCase();
        }).join("");
        
        // End with frantic exclamation and question mark clusters
        const punctuationSpikes = ["!!!1!", "??!?!!", "1!!", "!!!", "!!??"];
        result += " " + punctuationSpikes[Math.floor(Math.random() * punctuationSpikes.length)];
    } else if (dumbness > 0.5) {
        // Low education: Turn everything completely lowercase
        result = result.toLowerCase();
    }

    return result;
}