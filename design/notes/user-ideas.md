Visual rules.
The idea is that we can create a lot of variety from a small amount of assets, with mix and match techinques. we need to predefine probability for stuff in middle ground. for breviety ive shared what I think make sense for the middle grounds. but you'll have to figure out the stuff in between. this is also going to affect the building-street assets.

Also here's the sauce; the idea for this visual update is to also add a small 'simulation' sort of idea behind. We'll start the game with a list of names. They have random names and last names. We create 25 full names. For now the peds will be fairly simple creatures.

{
    name: "random name",
    type: "man" // no woman, children for now, to keep things easy.
    state: alive or dead, / can be updated to dead if they die
    skin: 0,1,2,3,4 // skin tone based on color table, has random chance, never changes
job: 'none' 'army' 'business' 'thief' // these will be calculated each round
happiness: 0 (clinically depressed) 10 (manic smorgasbord of happiness) // calculated each round,
faction: 
    }

## Infrastructure Effects

Infrastructure primarily affects clothing colors and visual cleanliness.

### Infrastructure 0

Civilian clothing palette:

* Dark Brown
* Grey
* Black
* Dirty Green
* Faded Blue

Characteristics:

* Worn appearance
* Low contrast
* Dusty textures

---

### Infrastructure 5

Civilian clothing palette:

* Red
* Blue
* Green
* White
* Yellow

Characteristics:

* Normal appearance
* Balanced colors

---

### Infrastructure 10

Civilian clothing palette:

* White
* Cream
* Ivory
* Sand
* Gold accents

Characteristics:

* Clean appearance
* Bright tropical resort aesthetic
* Wealth immediately visible

---

# Health Effects

Health affects civilian body composition.

## Health 0

Pedestrian body distribution:

* Slim: 100%
* Fit: 0%
* Fat: 0%
* No ambulances.

Population appears undernourished.

---

## Health 5

Pedestrian body distribution:

* Slim: 40%
* Fit: 40%
* Fat: 20%
* Every once in a while an ambulance.

Population appears normal.

---

## Health 10

Pedestrian body distribution:

* Slim: 0%
* Fit: 100%
* Fat: 0%
* Absurd number of ambulances

Population appears healthy and athletic.

Almost propaganda-level fitness.

---

VEHICLES

# Security Effects

## Security 0

* Increased thief spawns
* No soldiers visible

## Security 5

* Occasional soldiers
* Occasional military jeep

## Security 10

* Soldiers common
* Military jeeps common
* Streets visibly militarized

# Vehicle Color Rules

Infrastructure affects vehicle colors.

## Infrastructure 0

Vehicle palette:

* Rust Brown
* Dark Orange
* Mud Grey
* Black
* Faded Green

Characteristics:

* Dirty
* Poorly maintained
* Sun damaged

---

## Infrastructure 5

Vehicle palette:

* Red
* Blue
* Green
* White
* Yellow

Characteristics:

* Typical city traffic

---

## Infrastructure 10

Vehicle palette:

* White
* Ivory
* Cream
* Black
* Gold

Characteristics:

* Luxury appearance
* Well maintained
* Matches elite architecture

