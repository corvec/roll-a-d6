import * as d6 from './index.js';

const { getAllRolls } = d6.helpers;
import type { MacroMap, ResultEntry, RollLog } from './types.js';
import type { ResultRange } from './rollFormula.js';


it('simple example works', () => {
  const roll = d6.rollFormula('1d20+Strength,1d8+Strength', { Strength: '5' });
  expect(roll.result.length).toBe(2);
  expect(typeof roll.result[0]).toBe('number');
  expect(typeof roll.result[1]).toBe('number');
});

it('uses the optional targetedCollections param', () => {
  const formula = 'local+10>remote@Remote->15;10';
  const collectionFormulasMap = { local: '1d20' };
  const targetedCollections = {
    Remote: {
      rolls: { remote: '5' },
      collections: {},
    },
  };
  const roll = d6.rollFormula(formula, collectionFormulasMap, targetedCollections);
  expect(roll.result.length).toBe(1);
  expect(roll.result[0]).toBe(15);
});

it('more complicated example works', () => {
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
  const results = roll.result as ResultRange[];
  const foundResult = results.find(({ minValue, maxValue }) => minValue <= 15 && !((maxValue as number) < 15));
  expect(foundResult).toBeDefined();
  expect((foundResult as ResultRange).result.length).toBe(1);
  expect(typeof (foundResult as ResultRange).result[0]).toBe('number');
});

it('roll details for un-traversed paths are not present', () => {
  const formula = '1d20+bonus>20->1d10+1d8+1d6;0';
  const roll1 = d6.rollFormula(formula, { bonus: '0' });
  const roll2 = d6.rollFormula(formula, { bonus: '20' });
  expect(getAllRolls(roll1.rolls as RollLog).length).toBe(1);
  expect(getAllRolls(roll2.rolls as RollLog).length).toBe(4);
});

it('throws a ValidationError for an invalid formula', () => {
  expect(() => d6.rollFormula('1+', {})).toThrow(d6.ErrorTypes.ValidationError);
  expect(() => d6.rollFormula('1+', {})).toThrow(/Invalid formula/);
});

it('accepts an injected rng for deterministic rolls', () => {
  const minRoll = d6.rollFormula('1d20+Strength,1d8+Strength', { Strength: '5' }, {}, { rng: () => 0 });
  expect(minRoll.result).toEqual([6, 6]);
  const maxRoll = d6.rollFormula('1d20+Strength,1d8+Strength', { Strength: '5' }, {}, { rng: () => 0.999999 });
  expect(maxRoll.result).toEqual([25, 13]);
});

it('handles side effects with lowercase target collections', () => {
  const formula = '1d20>0->$sneakAttack@target-=1...10;0';
  const { result, sideEffects } = d6.rollFormula(formula, { 'sneakAttack@target': '1' });
  expect(result[0]).toBe(10);
  expect(sideEffects).toStrictEqual({ 'sneakAttack@target': 0 });
});

it('handles internal-only side effects', () => {
  const formula = 'a=1,decA=a>0->$a-=1...10;0,decA+decA';
  const { result, sideEffects } = d6.rollFormula(formula, {});
  expect(result[0]).toBe(10);
  expect(sideEffects).toStrictEqual({ a: 0 });
});

it('returns side effects that affect the collection macros', () => {
  const formula = '1d20>0->$sneakAttack-=1...10;0';
  const { result, sideEffects } = d6.rollFormula(formula, { sneakAttack: '1' });
  expect(result[0]).toBe(10);
  expect(sideEffects).toStrictEqual({ sneakAttack: 0 });
});

it('handles side effects with target collections', () => {
  const formula = '1d20>0->$sneakAttack@Target-=1...10;0';
  const { result, sideEffects } = d6.rollFormula(formula, { 'sneakAttack@Target': '1' });
  expect(result[0]).toBe(10);
  expect(sideEffects).toStrictEqual({ 'sneakAttack@Target': 0 });
});

it('handles recursive rolls with side effects', () => {
  const formula = 'i=0,r=i<10->$i+=1...1+r;0,r';
  const { result, sideEffects } = d6.rollFormula(formula, {});
  expect(result[0]).toBe(10);
  expect(sideEffects).toStrictEqual({ i: 10 });
});

it('handles result ranges', () => {
  const formula = 'm=?,5>m->1d10;0';
  const roll = d6.rollFormula(formula, {});
  const results = roll.result as ResultRange[];
  expect(results.length).toBe(2);
  expect(results[0].minValue).toBe(0);
  expect(results[0].maxValue).toBe(4);
  expect((results[0].result[0] as number) > 0).toBe(true);
  expect(results[1].minValue).toBe(5);
  expect(results[1].maxValue).toBe(undefined);
  expect(results[1].result[0]).toBe(0);
});

it('handles result ranges with simple incongruous dice paths', () => {
  const formula = 'm=?,5<=m->1d10;0';
  const roll = d6.rollFormula(formula, {});
  const results = roll.result as ResultRange[];
  expect(results.length).toBe(2);
  expect(results[0].minValue).toBe(0);
  expect(results[0].maxValue).toBe(4);
  expect(results[0].result[0]).toBe(0);
  expect(results[1].minValue).toBe(5);
  expect(results[1].maxValue).toBe(undefined);
  expect((results[1].result[0] as number) > 0).toBe(true);
});

it('works with a different, incongrous dice path', () => {
  const formula = 'ac=?,p1=5d2,p2=5d1000,5>ac->p1;p2';
  const roll = d6.rollFormula(formula, {});
  const results = roll.result as ResultRange[];
  expect(results.length).toBe(2);
  expect((results[0].result[0] as number) < 11).toBe(true);
  expect((results[1].result[0] as number) > 11).toBe(true);
});

it('supports a custom maxRange for result ranges', () => {
  const formula = 'm=?,m>=50->1;0';
  // With the default maxRange of 40, the boundary at 50 is never probed
  const defaultRoll = d6.rollFormula(formula, {});
  expect((defaultRoll.result as ResultRange[]).length).toBe(1);
  // With a larger maxRange, the boundary is found
  const roll = d6.rollFormula(formula, {}, {}, { maxRange: 60 });
  const results = roll.result as ResultRange[];
  expect(results.length).toBe(2);
  expect(results[0].maxValue).toBe(49);
  expect(results[0].result).toEqual([0]);
  expect(results[1].minValue).toBe(50);
  expect(results[1].result).toEqual([1]);
});

it('buildResultRange tested with Animate Objects (failing case found in 0.2.2)', () => {
  const expressions = [['number', 'deadObjects', '-', 'atk', '#+']];
  const allMacros: MacroMap = {
    dmgMod: ['4'],
    prof: ['4'],
    number: ['10'],
    r: ['1d20'],
    deadObjects: ['0'],
    atk: ['roll[0]', '20', '==', '=>', 'dmgDice[0]', 'dmgDice[1]', '+', 'dmgMod', '+', '->', 'roll[0]', '1', '==', '=>', '0', '->', 'roll[0]', 'bonus', '+', 'ac@Defender', '>=', '=>', 'dmgDice[0]', 'dmgMod', '+', '->', '0', ';', ';', ';'],
    bonus: ['prof', 'dmgMod', '+'],
    'ac@Defender': ['?'],
    roll: ['^adv', '^disadv', '&&', 'adv', '0', '==', 'disadv', '0', '==', '&&', '||', '=>', 'r[0]', '->', 'adv', '=>', ';', 'r[0]', 'r[1]', '>>', '->', 'r[0]', 'r[1]', '<<', ';'],
    dmgDice: ['tinyObjects'],
    adv: ['1'],
    tinyObjects: ['1d4'],
    disadv: ['0'],
  };
  const result: ResultEntry[] = [72];
  const rolls: RollLog = {
    4: ['2(d4)', '2(d4)', '2(d4)', '3(d4)', '3(d4)', '2(d4)', '4(d4)', '3(d4)', '4(d4)', '3(d4)', '3(d4)', '1(d4)'],
    20: ['5(d20)', '18(d20)', '14(d20)', '6(d20)', '7(d20)', '7(d20)', '20(d20)', '19(d20)', '16(d20)', '18(d20)', '5(d20)', '7(d20)', '4(d20)', '20(d20)', '13(d20)', '9(d20)', '19(d20)', '15(d20)', '16(d20)', '18(d20)'],
  };
  const uncertainValues = ['ac@Defender'];
  const initialSideEffects = {};
  const macrosWithCertainty = (value: number) => ({
    ...allMacros,
    [uncertainValues[0]]: [`${value}`],
  });
  const resultRange = d6.formulaRoller.buildResultRange({
    expressions, result, rolls, uncertainValues, initialSideEffects, macrosWithCertainty,
  });
  const expectedResultRange = [
    {
      variable: 'ac@Defender',
      minValue: 0,
      result: [72],
      sideEffects: {},
      maxValue: 15,
    },
    { minValue: 16, result: [60], sideEffects: {}, maxValue: 21 },
    { minValue: 22, result: [53], sideEffects: {}, maxValue: 22 },
    { minValue: 23, result: [45], sideEffects: {}, maxValue: 26 },
    { minValue: 27, result: [24], sideEffects: {}, maxValue: 27 },
    { minValue: 28, result: [17], sideEffects: {} },
  ];
  expect(resultRange).toEqual(expectedResultRange);
});


it('buildResultRange tested with Animate Objects (another failing case found in 0.2.2, #+ not used)', () => {
  const expressions = [['atk', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+']];
  const allMacros: MacroMap = {
    dmgMod: ['4'],
    prof: ['4'],
    number: ['10'],
    r: ['1d20'],
    atk: ['roll[0]', '20', '==', '=>', 'dmgDice[0]', 'dmgDice[1]', '+', 'dmgMod', '+', '->', 'roll[0]', '1', '==', '=>', '0', '->', 'roll[0]', 'bonus', '+', 'ac@Defender', '>=', '=>', 'dmgDice[0]', 'dmgMod', '+', '->', '0', ';', ';', ';'],
    bonus: ['prof', 'dmgMod', '+'],
    'ac@Defender': ['?'],
    roll: ['^adv', '^disadv', '&&', 'adv', '0', '==', 'disadv', '0', '==', '&&', '||', '=>', 'r[0]', '->', 'adv', '=>', ';', 'r[0]', 'r[1]', '>>', '->', 'r[0]', 'r[1]', '<<', ';'],
    dmgDice: ['tinyObjects'],
    adv: ['1'],
    tinyObjects: ['1d4'],
    disadv: ['0'],
  };
  const result: ResultEntry[] = [72];
  const rolls: RollLog = {
    4: ['3(d4)', '2(d4)', '4(d4)', '4(d4)', '4(d4)', '4(d4)', '2(d4)', '3(d4)', '1(d4)', '3(d4)', '1(d4)', '1(d4)'],
    20: ['13(d20)', '3(d20)', '12(d20)', '4(d20)', '2(d20)', '13(d20)', '17(d20)', '17(d20)', '15(d20)', '11(d20)', '15(d20)', '3(d20)', '20(d20)', '18(d20)', '7(d20)', '20(d20)', '3(d20)', '15(d20)', '9(d20)', '7(d20)'],
  };
  const uncertainValues = ['ac@Defender'];
  const initialSideEffects = {};
  const macrosWithCertainty = (value: number) => ({
    ...allMacros,
    [uncertainValues[0]]: [`${value}`],
  });
  const resultRange = d6.formulaRoller.buildResultRange({
    expressions, result, rolls, uncertainValues, initialSideEffects, macrosWithCertainty,
  });
  const expectedResultRange = [
    { 'maxValue': 17, 'minValue': 0, 'result': [72], 'sideEffects': {}, 'variable': 'ac@Defender' },
    { 'maxValue': 20, 'minValue': 18, 'result': [67], 'sideEffects': {} },
    { 'maxValue': 21, 'minValue': 21, 'result': [62], 'sideEffects': {} },
    { 'maxValue': 23, 'minValue': 22, 'result': [50], 'sideEffects': {} },
    { 'maxValue': 25, 'minValue': 24, 'result': [29], 'sideEffects': {} },
    { 'minValue': 26, 'result': [21], 'sideEffects': {} },
  ];
  expect(resultRange).toEqual(expectedResultRange);
});

describe('chained else-if conditionals', () => {
  it('takes the first branch whose condition is true', () => {
    expect(d6.rollFormula('v=1,v==1->11;v==2->22;33', {}).result).toEqual([11]);
    expect(d6.rollFormula('v=2,v==1->11;v==2->22;33', {}).result).toEqual([22]);
    expect(d6.rollFormula('v=3,v==1->11;v==2->22;33', {}).result).toEqual([33]);
  });

  it('supports three chained else-ifs', () => {
    const formula = 'v==1->11;v==2->22;v==3->33;v==4->44;0';
    expect(d6.rollFormula(formula, { v: '3' }).result).toEqual([33]);
    expect(d6.rollFormula(formula, { v: '4' }).result).toEqual([44]);
    expect(d6.rollFormula(formula, { v: '5' }).result).toEqual([0]);
  });

  it('matches the behavior of explicitly parenthesized chains', () => {
    [1, 2, 3].forEach(v => {
      const chained = d6.rollFormula(`v=${v},v==1->11;v==2->22;33`, {});
      const parenthesized = d6.rollFormula(`v=${v},v==1->11;(v==2->22;33)`, {});
      expect(chained.result).toEqual(parenthesized.result);
    });
  });

  it('does not roll dice in untaken chain branches', () => {
    const { result, rolls } = d6.rollFormula('v=2,v==1->1d4;v==2->1d6;1d8', {});
    expect(typeof result[0]).toBe('number');
    expect(Object.keys(rolls)).toEqual(['6']);
  });
});

describe('whitespace in formulas', () => {
  it('ignores whitespace around operators and values', () => {
    expect(d6.rollFormula('2 + 3 * 4', {}).result).toEqual([14]);
    expect(d6.rollFormula('v = 5, v == 5 -> 1; 0', {}).result).toEqual([1]);
  });

  it('validates formulas with whitespace', () => {
    expect(d6.validateFormula('1d20 + 5')).toEqual([]);
  });
});

describe('exploding dice formulas', () => {
  it('validates and rolls NdX! notation', () => {
    expect(d6.validateFormula('2d6!+5')).toEqual([]);
    const { result } = d6.rollFormula('2d6!+5', {}, {}, { rng: () => 0 });
    expect(result).toEqual([7]);
  });

  it('explodes with a deterministic rng', () => {
    const values = [0.99, 0.1, 0.1]; // d6: 6, 1, 1 -> 1d6! = 7, second 1d6 = 1
    let i = 0;
    const { result } = d6.rollFormula('1d6!+1d6', {}, {}, { rng: () => values[i++ % values.length] });
    expect(result).toEqual([8]);
  });
});

describe('fudge dice formulas', () => {
  it('validates and rolls NdF notation', () => {
    expect(d6.validateFormula('4dF+2')).toEqual([]);
    expect(d6.rollFormula('4dF+2', {}, {}, { rng: () => 0 }).result).toEqual([-2]);
    expect(d6.rollFormula('4dF+2', {}, {}, { rng: () => 0.99 }).result).toEqual([6]);
  });

  it('rejects exploding fudge dice', () => {
    expect(d6.validateFormula('4dF!')).toContainEqual(expect.any(String));
  });
});

describe('max() and min() functions', () => {
  it('evaluates max and min of plain values', () => {
    expect(d6.rollFormula('max(3,7)', {}).result).toEqual([7]);
    expect(d6.rollFormula('min(3,7)', {}).result).toEqual([3]);
    expect(d6.rollFormula('max(1,5,3)', {}).result).toEqual([5]);
  });

  it('accepts whitespace and expressions in arguments', () => {
    expect(d6.rollFormula('max(2 + 3, 16)', {}).result).toEqual([16]);
  });

  it('compares a whole roll against a floor, like max(3d6, 16)', () => {
    expect(d6.rollFormula('max(3d6, 16)', {}, {}, { rng: () => 0 }).result).toEqual([16]);
    expect(d6.rollFormula('max(3d6, 16)', {}, {}, { rng: () => 0.999 }).result).toEqual([18]);
  });

  it('spreads a roll into individual dice, like max(...3d6, 5)', () => {
    const values = [0.1, 0.9, 0.3]; // d6: 1, 6, 2
    let i = 0;
    const spread = d6.rollFormula('max(...3d6, 5)', {}, {}, { rng: () => values[i++ % values.length] });
    expect(spread.result).toEqual([6]);
    i = 0;
    const lowSpread = d6.rollFormula('max(...3d6, 5)', {}, {}, { rng: () => 0 });
    expect(lowSpread.result).toEqual([5]); // all dice rolled 1
  });

  it('takes the lowest single die with min(...NdX)', () => {
    const values = [0.9, 0.1]; // d20: 19, 3
    let i = 0;
    const { result, rolls } = d6.rollFormula('min(...2d20)', {}, {}, { rng: () => values[i++ % values.length] });
    expect(result).toEqual([3]);
    expect(rolls[20]).toHaveLength(2);
  });

  it('works with macros as arguments', () => {
    expect(d6.rollFormula('max(a, b)', { a: '4', b: '9' }).result).toEqual([9]);
  });

  it('works inside conditionals and is skipped on untaken branches', () => {
    const { result, rolls } = d6.rollFormula('1>2->max(...3d6,5);7', {});
    expect(result).toEqual([7]);
    expect(Object.keys(rolls)).toEqual([]);
  });

  it('validates function-call syntax', () => {
    expect(d6.validateFormula('max(3d6, 16)')).toEqual([]);
    expect(d6.validateFormula('max(...3d6, 5)')).toEqual([]);
    expect(d6.validateFormula('max(,5)')).toContainEqual(expect.any(String));
    expect(d6.validateFormula('max(5,)')).toContainEqual(expect.any(String));
  });

  it('throws UnknownVariablesError for unknown functions', () => {
    expect(() => d6.rollFormula('foo(1,2)', {})).toThrow(d6.ErrorTypes.UnknownVariablesError);
    expect(() => d6.rollFormula('foo(1,2)', {})).toThrow(/foo/);
  });
});

describe('text lookup tables', () => {
  const macros = { encounterTable: '[1-2: Goblin ambush, 3-5: Wolves, 6: Ancient dragon]' };

  it('returns the matching row text for a roll', () => {
    expect(d6.rollFormula('encounterTable(1d6)', macros, {}, { rng: () => 0 }).result)
      .toEqual(['Goblin ambush']);
    expect(d6.rollFormula('encounterTable(1d6)', macros, {}, { rng: () => 0.999 }).result)
      .toEqual(['Ancient dragon']);
  });

  it('accepts expressions as the selector argument', () => {
    expect(d6.rollFormula('encounterTable(2+1)', macros).result).toEqual(['Wolves']);
  });

  it('supports default rows', () => {
    const withDefault = { t: '[20: crit!, default: no crit]' };
    expect(d6.rollFormula('t(5)', withDefault).result).toEqual(['no crit']);
    expect(d6.rollFormula('t(20)', withDefault).result).toEqual(['crit!']);
  });

  it('works through targeted collections', () => {
    const targetedCollections = {
      GM: { rolls: { reaction: '[1-3: hostile, 4+: friendly]' }, collections: {} },
    };
    expect(d6.rollFormula('reaction@GM(4)', {}, targetedCollections).result).toEqual(['friendly']);
  });

  it('supports comparing two lookups with ==', () => {
    const tableMacros = { mood: '[1-3: angry, 4-6: calm]' };
    expect(d6.rollFormula('mood(1)==mood(2)->10;20', tableMacros).result).toEqual([10]);
    expect(d6.rollFormula('mood(1)==mood(5)->10;20', tableMacros).result).toEqual([20]);
  });

  it('throws UnknownVariablesError for a missing table', () => {
    expect(() => d6.rollFormula('missingTable(1d6)', {})).toThrow(d6.ErrorTypes.UnknownVariablesError);
  });

  it('throws a ValidationError for a malformed table definition', () => {
    expect(() => d6.rollFormula('t(1)', { t: '[bad row]' })).toThrow(d6.ErrorTypes.ValidationError);
  });
});
