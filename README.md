# Roll A D6

`roll-a-d6` is a dice-rolling engine that supports sophisticated macros and formulas that no
other dice roller supports.

The library is written in TypeScript and ships with its own type declarations, alongside both
ESM and CommonJS builds. No runtime dependencies are required.

```javascript
import * as d6 from 'roll-a-d6';

const roll = d6.rollFormula('1d20+Strength,1d8+Strength', { Strength: '5' });
console.log(roll.result.join(', '));
```

The components of the dice roller include the validator, tokenizer, parser, RPN converter,
and evaluator.

## Syntax at a glance

| You write | Meaning |
| --- | --- |
| `2d6` | Roll two six-sided dice and add them |
| `2d6!` | As above, but each die *explodes*: a maximum roll is rolled again and added |
| `4dF` | Roll four fudge/Fate dice (each −1, 0, or +1) |
| `1d8+Str` | Roll and add the macro or variable `Str` |
| `+ - * /` | Arithmetic (`/` rounds down) |
| `> < >= <= == <>` | Comparisons returning `true`/`false` (`<>` is "not equal") |
| `5>>3`, `5<<3` | Greater-of (5) and lesser-of (3) |
| `&& \|\|` | Logical AND / OR |
| `cond->a;b` | If `cond` then `a` else `b` |
| `c1->a;c2->b;c` | Chained else-if: first true condition wins |
| `4#+1d6` | Roll `1d6` four times and add the results (see expansion operators) |
| `max(a,b,…)`, `min(a,b,…)` | Largest / smallest argument |
| `max(...3d6, 5)` | Spread: each die is a separate argument |
| `name=…` | Assign an inline macro, e.g., `r=1d20,r[0]>10->r[0];0` |
| `r[0]`, `r{0}` | Local / global macro instance (evaluate once, reuse) |
| `$uses-=1`, `$hp:=0` | Side effects |
| `^adv` | Use 0 instead of prompting when `adv` isn't supplied |
| `ac@Defender` | Reference `ac` from the targeted collection `Defender` |
| `t(1d6)` with `t: '[1-2: Goblin, 3+: Orc]'` | Text lookup table |
| `t(1d6)` with `t: '[[1-2: 1d8, 3+: 2d8+2]]'` | Formula lookup table (lazy) |
| `ac=?` | Uncertain value: evaluate across a range of inputs |

Whitespace is not significant: `max(3d6, 16)` and `max(3d6,16)` are the same formula.
A comma separates top-level expressions, so one formula can produce several results.

## API

### `rollFormula(formula, macros, targetedCollections, options)`

Validates, parses, and evaluates `formula`. `macros` maps names to definitions — either
formulas (`{ Strength: '5' }`) or lookup tables. `targetedCollections` provides named
collections addressable with `@` (see Targeted collections). The returned object includes:

* `result` — the evaluated result of each top-level expression (numbers, booleans, or
  lookup-table text), or an array of `ResultRange`s when the formula contains `?`.
* `rolls` — a log of every die rolled, keyed by sides, e.g., `{6: ['1(d6)','5(d6)'], F: ['-1(dF)']}`.
  Pass a saved log back in (via `evaluateFormula`) to replay rolls deterministically.
* `sideEffects` — values changed via `:=`, `+=`, or `-=`.

It throws `ErrorTypes.ValidationError` (with an `issues` array) if the formula fails
validation, and `ErrorTypes.UnknownVariablesError` (with an `unknownVariables` array) if the
formula references variables, macros, or lookup tables that are not available.

`options` accepts:

* `rng` — a function returning a number in `[0, 1)`, used as the source of randomness for
  dice rolls. Defaults to `Math.random`. Inject a seeded generator for deterministic,
  reproducible rolls.
* `maxRange` — when the formula contains an uncertain value (`?`), input values from `0` up
  to (but not including) `maxRange` are probed to build the result ranges. Defaults to `40`.

A more sophisticated example:

```javascript
import * as d6 from 'roll-a-d6';

const macros = {
  roll: 'r=1d20,(^adv&&^disadv)||(adv==0&&disadv==0)->r[0];(adv->r[0]>>r[1];r[0]<<r[1])',
  atk: 'roll[0]==20->dmgDice[0]+dmgDice[1]+dmgMod;roll[0]==1->0;roll[0]+bonus>ac@Defender->dmgDice[0]+dmgMod;0',
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
console.log(foundResult.result[0]);
```

## Roll Syntax

### Constants

Integers (including negative integers, e.g., `-3`) and the booleans `true` and `false`.

### Rolls

Rolls are written *x*d*y*: `1d20` rolls one twenty-sided die, `3d6` rolls three six-sided
dice and adds them.

#### Exploding dice

Append `!` to make the dice explode: whenever a die rolls its maximum value, it is rolled
again and the new roll is added, repeating for as long as the maximum keeps coming up.
`3d6!` rolls three exploding d6s; each die explodes independently. (A single die's chain is
capped at 100 rolls, and a `d1` never explodes.)

#### Fudge dice

`4dF` rolls four fudge/Fate dice. Each die comes up −1, 0, or +1, so `4dF+2` implements a
typical Fate check. Fudge dice appear in the roll log under the key `F` and cannot explode.

### Operators

Operators are written infix, e.g., `5+7`, though they are evaluated postfix.

#### Arithmetic

`+`, `-`, `*`, `/`. Division rounds down (`9/4` is `2`).

#### Comparisons

Greater than (`>`), less than (`<`), and other similar operators (`<=`, `>=`, `==`, and `<>`
(not equal)) return `true` or `false`.

Greater-of (`>>`) and lesser-of (`<<`) return the appropriate value, e.g., `5<<7` returns `5`.
For more than two values — or to work with individual dice — see `max()` and `min()` below.

#### Logic

`||` and `&&` perform the equivalent operations.

#### Conditionals

`->` and `;` are the equivalents of "then" and "else". For example, `1d20>10->1d6;0` first
rolls 1d20 and compares the result to 10. If it is greater, it rolls 1d6 and returns that
result; otherwise it returns 0. Only the taken branch is evaluated — dice in the other
branch are never rolled.

Conditionals chain as **else-if** without extra parentheses — the first true condition wins:

```
roll[0]==20->crit;roll[0]==1->0;roll[0]+bonus>=ac->dmg;0
```

is read as *if* nat 20 *then* crit, *else if* nat 1 *then* 0, *else if* it hits *then* dmg,
*else* 0. You can chain as many conditions as you need. (Parenthesizing each else-branch
explicitly still works and means the same thing.)

#### Functions: max() and min()

`max(…)` and `min(…)` take any number of comma-separated arguments, each a full expression:

* `max(3d6, 16)` — roll 3d6 and return the total or 16, whichever is higher.
* `min(1d20+5, 1d20+3, 20)` — the lowest of the three.

Prefix a roll with `...` to **spread** it, passing each die as its own argument:

* `max(...3d6, 5)` — the highest single d6, with a floor of 5.
* `min(...2d20)` — the lower of two d20s (like rolling with disadvantage).

Spread works only on dice rolls used directly as function arguments. `max` and `min` are
reserved: a macro with either name is shadowed by the built-in when called with parentheses.

#### Expansion operators

These operators allow you to roll the same thing many times with ease. For example, `4#+1d6`
is the equivalent of `1d6+1d6+1d6+1d6`. This is distinct from `4*1d6` because the former
rolls four dice; the latter rolls one die and multiplies. (Note that the repeated term must
be a plain roll or macro reference: in `4#+(1d6+2)` the parenthesized value is computed once
and reused.)

The following operators are supported:

* `#+` - Add the results together
* `#*` - Multiply the results together
* `#&` - AND (`&&`) the results together, returning the last value if all are truthy, or the first falsy value.
* `#|` - OR (`||`) the results together, returning the last value if all are falsy, or the first truthy value.

### Lookup tables

A macro whose definition is wrapped in brackets is a lookup table. Call it like a function,
with the selector (usually a roll) as the single argument. Rows are separated by commas; each
row is `selector: value`. Selectors may be a single value (`3`), an inclusive range (`3-5`),
an open range (`6+`), or `default` (used when nothing else matches). The first matching row
wins; if no row matches and there is no default, evaluation fails with a descriptive error.

**Text tables** use single brackets and return the row's text verbatim:

```javascript
const macros = { encounterTable: '[1-2: Goblin ambush, 3-5: Wolves, 6: Ancient dragon]' };
d6.rollFormula('encounterTable(1d6)', macros).result; // e.g., ['Wolves']
```

Text values may not contain commas, colons, or brackets.

**Formula tables** use double brackets; the selected row's value is itself a formula,
evaluated only when that row is selected (so untaken rows never roll dice or apply side
effects):

```javascript
const macros = {
  critTable: '[[1-19: dmgDice+dmgMod, 20: max(2#+dmgDice, dmgDice+10)+dmgMod]]',
};
d6.rollFormula('critTable(1d20)', macros);
```

Rows may use the full language — dice, macros, conditionals, functions, side effects, and
even calls into other tables.

### Default values

Prefixing a variable reference with `^` will cause it to be treated as 0 if it was not passed in.

### Uncertain values

Assign `?` to a value you don't know (e.g., `ac@Defender=?`) and the formula is evaluated
across a range of inputs (`0` to `maxRange`). The result is an array of ranges, each with
`minValue`/`maxValue` and the corresponding `result` — useful for "tell me the outcome for
any AC" style rolls. Only one value may be uncertain per formula.

### Macro evaluation

By using the name of a macro, you can evaluate that macro in your formula.
Macros can also reference other macros.

Here is a simple example:

```javascript
import * as d6 from 'roll-a-d6';

const macros = {
  macro: '1d20>10->helperMacro;0',
  helperMacro: '1d10+5',
};
const formula = 'macro+macro';
const roll = d6.rollFormula(formula, macros);
```

You can also assign macros inline within a formula: `r=1d20,r>10->r;0` defines `r` for the
rest of that formula. Assignment must be the first thing in its clause.

#### Global and Local Macro Instance Evaluation

You may want to check the result of a macro and then use it.
There are a couple ways to do this.

One way involves using the `>>` and `<<` operators.
For example, to choose the higher value between `macro1` and `macro2`, you would write
`macro1>>macro2`.

The more advanced way involves global and local macro instances.

`[]` is used for local macro instances. `{}` is used for global macro instances.

Local macro instance evaluations are used only for the currently evaluated macro / formula.
For example, you might want to know if the result of 1d20 was 20, 1, or if it was above a certain value.
You can do this like so: `r=1d20,r[0]==20->crit;r[0]==1->miss;r[0]>=minimum->hit;0`

Global macro instance evaluations are used for every macro that references them.
They are more useful in very focused applications rather than in more general, reusable rolls.

### Targeted collections

Variables suffixed with `@Name` (e.g., `ac@Defender`) resolve against the collection `Name`
passed in `targetedCollections`. Collections can provide values, macros, and lookup tables.

### Side Effects

As the result of a roll, you may want to change some value, like decreasing your uses of an ability.
Alternatively, you may want to track a value during a roll and use it to determine what to do next.
You can do this with side effects!

Currently, only three side effects are supported:

* `:=` (assignment)
* `+=` (increment)
* `-=` (decrement)

If you wish to apply a side effect, you must prefix the name of the variable with `$`.

You can use the `...` pseudo-operator between a side effect and the result you want to return.

One example of a side effect, using the macros from above:

```javascript
  const myMacros = {
    ...macros,
    sneakAttack: '3d6',
    sneakAttackIfPossible: 'canSneakAttack>0->$canSneakAttack:=0...sneakAttack;0',
    attackWithSneakAttack: 'atk[0]>0->atk[0]+sneakAttackIfPossible;0',
  };
  const formula = 'canSneakAttack=1,2#+attackWithSneakAttack';
  d6.rollFormula(formula, myMacros);
```
