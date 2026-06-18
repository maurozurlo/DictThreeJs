random shit
eventually people could have age set up in their creation and could get old and died. The newspaper is already implemented... we could even add an obituary section
I think this is one of those mechanics that could elevate the entire game if we do it right.

The trick is to make the obituary section feel like it's written by a newspaper that's genuinely trying to be respectful, while the circumstances are obviously ridiculous.

Not:

> RICARDO DIED LOL

But:

> Ricardo Fernández, beloved father and amateur fisherman, passed away yesterday after a brief disagreement with the National Banana Disposal Authority.

The contrast is where the comedy comes from.

---

### Security High

**Ricardo Fernández, 54**

> Passed peacefully after a minor misunderstanding regarding banana disposal regulations. He is survived by his wife, two children, and the sixty-seven officers involved in the incident.

---

**Miguel Herrera, 32**

> Passed unexpectedly after accidentally entering a military parade from the wrong direction. The parade remained perfectly synchronized throughout the ordeal.

---

**Carlos Martínez, 71**

> Passed while attempting to explain to a checkpoint officer that he had already visited the checkpoint earlier that morning.

---

### Health Low

**José Álvarez, 48**

> Departed after spending twelve consecutive years on the waiting list for a routine checkup. His patience was widely admired.

---

**Eduardo Gómez, 63**

> Passed comfortably at home after reading that a new hospital would be built "very soon."

---

### Infrastructure Low

**Luis Fernández, 39**

> Passed after a spirited disagreement between his bicycle and a pothole officially classified as a geological feature.

---

**Fernando Ruiz, 27**

> Was last seen attempting to cross Main Street during the annual Sinkhole Appreciation Festival.

---

### Happiness Very Low

**Raúl García, 44**

> Passed after loudly declaring that things couldn't possibly get worse. He will be remembered for his optimism.

---

### Military Coup

**Ricardo Fernández, 54**

> Passed peacefully during the brief exchange of celebratory artillery fire that accompanied yesterday's transfer of government responsibilities.

---

### Absurd Laws

**Pigeons**

**Manuel Soto, 67**

> Passed while attempting to identify his pigeon among approximately three thousand identical pigeons.


### My favorite approach

Give every citizen one or two random traits when generated:

```js
{
    name: "Ricardo Fernandez",
    hobby: "fishing",
    favoriteFood: "bananas",
    fear: "heights"
}
```

Then obituaries can reference them.

Example:

> Ricardo Fernández, avid fisherman and enthusiastic consumer of bananas, passed after a brief encounter with the Ministry of Fruit Compliance.

or

> Carlos Gómez, who spent his life avoiding heights, was tragically promoted to Chief Rooftop Inspector.

Suddenly the deaths feel weirdly personal.

Players start recognizing names.

And when the newspaper says:

> Ricardo Fernández has passed away.

the player thinks:

> Ah shit, not Ricardo. That guy loved fishing.

Which is exactly the kind of dark-but-wholesome humor that fits the tone you're building.

Protests can only happen in a specified "protest" spot in the map. This will be funnier than peds randomly protesting in random places.

ALSO there will be an entire sprint dedicated to overhaul the newspaper. Im thinking we'll make a system so laws/deals/mini challenges/daily events/budget changes/tax changes they all may contain an optional headline. We'll weigh them as well. So that defines the headline of the day. There may also be 2/3 more headlines that appear in the newspaper.

Government Bias

The newspaper should become more propagandistic with charisma.

Low Charisma

Reality.

INFLATION REACHES 400%
Medium Charisma

Spin.

PRICE FLEXIBILITY REACHES NEW HEIGHTS
High Charisma

Complete delusion.

NATION ACHIEVES WORLD'S MOST
DYNAMIC ECONOMY

while everyone is starving.

Finally Ive been thinking about the advisors. My idea is simple but could be useful. Currently the advisors have a weird way of calculating their output. Since many things the player can do have (apart from values that are displayed/hidden to the player), a rollChance function, we should precompute these. The system already knows what will happen before the player clicks on anything.
Take this example: Player has high charisma, high education, they try to Dialogue with the People. Right now we have a high chance of succeding, but we don't know for sure until we click the button and we calculate it. Have it precalculated. and based on the level of advisor (0,1,2,3) their 'prediction' is more accurate. If we ask Kiki (the worst) he'll 9 times out of 10 give wrong advice. He'd be like 'Hell no, it's a terrible idea to talk to the people, they'll eat you alive!' while in reality we know that the dialogue will succeeed.

I think this is significantly better than most advisor systems because it turns advisors from:

> "+10% success chance"

into actual characters.

And more importantly, it solves a design problem:

> Why would I ever hire the expensive advisor?

Because now you're buying **information quality**.

---

### The core idea

Don't make advisors calculate outcomes.

The game already knows the outcome.

The advisor's job is to **interpret reality**.

```text
Actual outcome:
Success (83%)
```

Then each advisor sees that reality through their own level of competence.

---

### Example

Action:

```text
Dialogue With The People
```

Actual roll:

```text
Success
```

(Already precomputed this turn.)

---

#### Kiki (Level 0)

Accuracy: ~10%

Result:

> Don't do it.
>
> They'll tear you apart.
>
> Have you considered hiding?

---

#### Edward (Level 1)

Accuracy: ~50%

Result:

> Hmm...
>
> I don't know.
>
> Could go either way.

---

#### Ricky (Level 2)

Accuracy: ~75%

Result:

> Looks favorable.
>
> I think this is likely to work.

---

#### Alfonso (Level 3)

Accuracy: ~95%

Result:

> This will almost certainly succeed.

---

### The funny part

The advisors shouldn't merely be inaccurate.

They should be inaccurate in-character.

---

#### Kiki

Extremely emotional.

Every prediction is an overreaction.

Success:

> This is suicide.

Failure:

> This is suicide.

50/50:

> This is definitely suicide.

---

#### Edward

Technically educated.

Often wrong.

Uses jargon.

Success:

> According to my calculations there is a 37% chance of a positive outcome.

Actual chance:

92%.

---

#### Ricky

Good economist.

Good intuition.

Talks too much.

Success:

> If you look at the macroeconomic indicators, the social climate, the educational indexes, the historical trends...

Three paragraphs later:

> Yeah, probably works.

---

#### Alfonso

Almost always correct.

Painfully concise.

Success:

> Yes.

Failure:

> No.

---

### How I'd implement it

Not as accuracy.

As noise.

---

The game computes:

```csharp
actualChance = 83;
```

Advisor receives:

```csharp
displayChance =
actualChance + randomError;
```

Error ranges:

```text
Kiki: ±50

Edward: ±25

Ricky: ±10

Alfonso: ±3
```

Then convert to language.

---

### Example

Real chance:

```text
83%
```

Kiki sees:

```text
34%
```

Advice:

> Absolutely not.

````

Edward sees:

```text
62%
````

Advice:

> Seems acceptable.

````

Ricky sees:

```text
79%
````

Advice:

> Strong opportunity.

````

Alfonso sees:

```text
85%
````

Advice:

> Proceed.

````

---

### But here's the really fun idea

Give advisors **confidence**.

Sometimes Kiki is catastrophically wrong.

But incredibly confident.

```text
Kiki

★★★★★ Confidence

"THEY WILL KILL YOU."
````

Player follows advice.

Success.

---

Sometimes Alfonso says:

```text
Alfonso

★☆☆☆☆ Confidence

"I am uncertain."
```

Because the action is genuinely close to 50/50.

Now the player learns to read the advisors rather than blindly following them.

---

### My favorite extension

Keep a hidden track record.

Newspaper occasionally reports:

```text
ADVISOR PERFORMANCE REPORT

Kiki:
Correct predictions: 2

Incorrect predictions: 48
```

or

```text
Kiki claims previous report was fabricated.
```

Which somehow feels even more in character.

The beautiful thing is that the player starts with Kiki because he's cheap, spends half the game screaming "don't do it!", and then the first time they hire Alfonso they immediately understand why he's valuable:

> "Oh. This guy isn't giving buffs.
>
> He's giving me reality."

That's a much more interesting progression than a traditional advisor bonus system.

