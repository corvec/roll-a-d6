# Roll A D6

## What / why?

`roll-a-d6` is a dice rolling engine library that supports sophisticated macros and formulas that no other dice roller supports.

At its core, we have the dice roller: `rollFormula(formula, macrosObject)`

### Example:

```javascript
import * as d6 from 'roll-a-d6';

const roll = d6.rollFormula('1d20+Strength,1d8+Strength', { Strength: '5' });
console.log(roll.result.join(', '));
```

The components of the dice roller include the validator, tokenizer, parser, RPN converter, and evaluator.
For more information, check out the API docs [here](./jsdoc/roll-a-d6/0.2.2/global.html).

An example of a more sophisticated dice roll that this package supports:

```javascript
import * as d6 from 'roll-a-d6';

const macros = {
  roll: 'r=1d20,(^adv&&^disadv)||(adv==0&&disadv==0)->r[0];(adv->r[0]>>r[1];r[0]<<r[1])',
  atk: 'roll[0]==20->dmgDice[0]+dmgDice[1]+dmgMod;(roll[0]==1->0;roll[0]+bonus>ac@Defender->dmgDice[0]+dmgMod;0)',
  bonus: 'prof+dmgMod',
  shortSword: '1d6,dmgMod=Dex>>Str',
  sneakAttack: '3d6',
  sneakAttackIfPossible: 'canYouSneakAttack->sneakAttack;0',
  Str: '10',
  Dex: '18',
  prof: '3',
};
const roll = d6.rollFormula('ac@Defender=?,canYouSneakAttack=1,dmgDice=shortSword,(atk[0]+atk[1])>0->(atk[0]+atk[1]+sneakAttackIfPossible);0', macros);
//  now I know the attacker's AC is 15
const foundResult = roll.result.find(({ minValue, maxValue }) => minValue <= 15 && !(maxValue < 15));
console.log(foundResult[0]);
```

## Roll Syntax

### Constants

### Rolls

Rolls should be in the format of *x*d*y*, e.g., '1d20' or 

### Operators

Operators should be used infix, e.g., 5+7, though they are evaluated postfix.

#### Arithmetic

+, -, *, /

#### Comparisons

Greater than (`>`), Less than (`<`), and other similar operators (`<=`, `>=`, `==`, and `<>` (not equal))  return true or false.

Greater of (`>>`) and Lesser of (`<<`) return the appropriate value, e.g., `5<<7` returns `5`.

#### Logic

`||` and `&&` perform the equivalent operations.

#### Conditionals

`->` and  `;` are the equivalents of then and else. For example: `1d20>10->1d6;0` will first roll 1d20,
 then compare that value to 10. If the value is greater than 10, it will roll 1d6 and return the result 
 of that roll. If the value is less than or equal to 10, it will return 0.

#### Expansion operators

These operators allow you to roll the same thing many times with ease. For example, `4#+1d6` is the 
equivalent of `1d6+1d6+1d6+1d6`. This is distinct from 4*1d6 because the former will not reroll those
dice; the latter will.

The following operators are supported:

* `#+` - Add the results together
* `#*` - Multiply the results together
* `#&` - AND (`&&`) the results together, returning the last value if all are truthy, or the first falsy value.
* `#|` - OR (`||`) the results together, returning the last value if all are falsy, or the first truthy value.

#### Default values

Prefixing a variable reference with `^` will cause it to be treated as 0 if it was not passed in.

#### Macro evaluation

##### Global and Local Macro Instance Evaluation

