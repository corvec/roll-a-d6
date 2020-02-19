# Roll A D6

## What / why?

`roll-a-d6` is a dice rolling engine library that supports sophisticated macros and formulas that no other dice roller supports.

At its core, we have the dice roller:

### Example:

```javascript
import * as d6 from 'roll-a-d6';

const roll = d6.rollFormula('1d20 + Strength', { Strength: 5});
console.log(roll.result);
```

The components of the dice roller include the validator, tokenizer, parser, RPN converter, and evaluator.

An example of a more sophisticated dice roll that this package supports:

```javascript
const macros = {
  roll: 'r=1d20,(^adv&&^disadv)||(adv==0&&disadv==0)->r[0];(adv->r[0]>>r[1];r[0]<<r[1])',
  atk: 'roll[0]==20->dmgDice[0]+dmgDice[1]+dmgMod;(roll[0]==1->0;roll[0]+bonus>ac@Defender->dmgDice[0]+dmgMod;0)',
  bonus: 'prof+dmgMod',
  shortSword: '1d6,dmgMod=Dex>>Str',
  sneakAttackIfPossible: 'canYouSneakAttack->sneakAttack;0',
};
const roll = d6.rollFormula('ac=?,dmgDice=shortSword,(atk[0]+atk[1])>0->(atk[0]+atk[1]+sneakAttackIfPossible);0', macros);
//  now I know the attacker's AC is 15
console.log(roll.result.find(({ minValue, maxValue }) => minValue >= 15 && maxValue <= 15));
```

In addition to the dice roller, there are additional libs designed to aid with collection macros

