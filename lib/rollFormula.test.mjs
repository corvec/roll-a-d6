import * as d6 from './index';
import { getAllRolls } from "./helpers";


it('simple example works', () => {
  const roll = d6.rollFormula('1d20+Strength,1d8+Strength', { Strength: '5' });
  expect(roll.result.length).toBe(2);
  expect(typeof roll.result[0]).toBe('number');
  expect(typeof roll.result[1]).toBe('number');
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
  const foundResult = roll.result.find(({ minValue, maxValue }) => minValue <= 15 && !(maxValue < 15));
  expect(foundResult).toBeDefined();
  expect(foundResult.result.length).toBe(1);
  expect(typeof foundResult.result[0]).toBe('number');
});

it('roll details for un-traversed paths are not present', () => {
  const formula = '1d20+bonus>20->1d10+1d8+1d6;0';
  const roll1 = d6.rollFormula(formula, { bonus: '0'});
  const roll2 = d6.rollFormula(formula, { bonus: '20'});
  expect(getAllRolls(roll1.rolls).length).toBe(1);
  expect(getAllRolls(roll2.rolls).length).toBe(4);
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
  expect(roll.result.length).toBe(2);
  expect(roll.result[0].minValue).toBe(0);
  expect(roll.result[0].maxValue).toBe(4);
  expect(roll.result[0].result[0] > 0).toBe(true);
  expect(roll.result[1].minValue).toBe(5);
  expect(roll.result[1].maxValue).toBe(undefined);
  expect(roll.result[1].result[0]).toBe(0);
});

it('handles result ranges with simple incongruous dice paths', () => {
  const formula = 'm=?,5<=m->1d10;0';
  const roll = d6.rollFormula(formula, {});
  expect(roll.result.length).toBe(2);
  expect(roll.result[0].minValue).toBe(0);
  expect(roll.result[0].maxValue).toBe(4);
  expect(roll.result[0].result[0]).toBe(0);
  expect(roll.result[1].minValue).toBe(5);
  expect(roll.result[1].maxValue).toBe(undefined);
  expect(roll.result[1].result[0] > 0).toBe(true);
});

it('handles result ranges with simple incongruous dice paths', () => {
  const formula = 'm=?,5<=m->1d10;0';
  const roll = d6.rollFormula(formula, {});
  expect(roll.result.length).toBe(2);
  expect(roll.result[0].minValue).toBe(0);
  expect(roll.result[0].maxValue).toBe(4);
  expect(roll.result[0].result[0]).toBe(0);
  expect(roll.result[1].minValue).toBe(5);
  expect(roll.result[1].maxValue).toBe(undefined);
  expect(roll.result[1].result[0] > 0).toBe(true);
});

it('works with a different, incongrous dice path', () => {
  const formula='ac=?,p1=5d2,p2=5d1000,5>ac->p1;p2';
  const roll = d6.rollFormula(formula, {});
  expect(roll.result.length).toBe(2);
  expect(roll.result[0].result[0] < 11).toBe(true);
  expect(roll.result[1].result[0] > 11).toBe(true);
});

it('buildResultRange tested with Animate Objects (failing case found in 0.2.2)', () => {
  const expressions = [ [ 'number', 'deadObjects', '-', 'atk', '#+' ] ];
  const allMacros = {
    dmgMod: [ '4' ],
    prof: [ '4' ],
    number: [ '10' ],
    r: [ '1d20' ],
    deadObjects: [ '0' ],
    atk: ['roll[0]','20','==','=>','dmgDice[0]','dmgDice[1]','+','dmgMod','+','->','roll[0]','1','==','=>','0','->','roll[0]','bonus','+','ac@Defender','>=','=>','dmgDice[0]','dmgMod','+','->','0',';',';',';'],
    bonus: [ 'prof', 'dmgMod', '+' ],
    'ac@Defender': [ '?' ],
    roll: [ '^adv', '^disadv', '&&', 'adv', '0', '==', 'disadv', '0', '==', '&&', '||', '=>', 'r[0]', '->', 'adv', '=>', ';', 'r[0]', 'r[1]', '>>', '->', 'r[0]', 'r[1]', '<<', ';' ],
    dmgDice: [ 'tinyObjects' ],
    adv: [ '1' ],
    tinyObjects: [ '1d4' ],
    disadv: [ '0' ],
  };
  const result = [ 72 ];
  const rolls = {
    4: [ '2(d4)', '2(d4)', '2(d4)', '3(d4)', '3(d4)', '2(d4)', '4(d4)', '3(d4)', '4(d4)', '3(d4)', '3(d4)', '1(d4)' ],
    20: [ '5(d20)', '18(d20)', '14(d20)', '6(d20)', '7(d20)', '7(d20)', '20(d20)', '19(d20)', '16(d20)', '18(d20)', '5(d20)', '7(d20)', '4(d20)', '20(d20)', '13(d20)', '9(d20)', '19(d20)', '15(d20)', '16(d20)', '18(d20)' ],
  };
  const uncertainValues = [ 'ac@Defender' ];
  const initialSideEffects = {};
  const macrosWithCertainty = value => ({
    ...allMacros,
    [ uncertainValues[ 0 ] ]: [ `${value}` ],
  });
  const resultRange = d6.formulaRoller.buildResultRange({
    expressions, allMacros, result, rolls, uncertainValues, initialSideEffects, macrosWithCertainty,
  });
  const expectedResultRange = [
    {
      variable: 'ac@Defender',
      minValue: 0,
      result: [ 72 ],
      sideEffects: {},
      maxValue: 15
    },
    { minValue: 16, result: [ 60 ], sideEffects: {}, maxValue: 21 },
    { minValue: 22, result: [ 53 ], sideEffects: {}, maxValue: 22 },
    { minValue: 23, result: [ 45 ], sideEffects: {}, maxValue: 26 },
    { minValue: 27, result: [ 24 ], sideEffects: {}, maxValue: 27 },
    { minValue: 28, result: [ 17 ], sideEffects: {} }
  ];
  expect(resultRange).toEqual(expectedResultRange);
});


it('buildResultRange tested with Animate Objects (another failing case found in 0.2.2, #+ not used)', () => {
  const expressions = [ [ 'atk', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+' ] ];
  const allMacros = {
    dmgMod: [ '4' ],
    prof: [ '4' ],
    number: [ '10' ],
    r: [ '1d20' ],
    atk: ['roll[0]','20','==','=>','dmgDice[0]','dmgDice[1]','+','dmgMod','+','->','roll[0]','1','==','=>','0','->','roll[0]','bonus','+','ac@Defender','>=','=>','dmgDice[0]','dmgMod','+','->','0',';',';',';'],
    bonus: [ 'prof', 'dmgMod', '+' ],
    'ac@Defender': [ '?' ],
    roll: [ '^adv', '^disadv', '&&', 'adv', '0', '==', 'disadv', '0', '==', '&&', '||', '=>', 'r[0]', '->', 'adv', '=>', ';', 'r[0]', 'r[1]', '>>', '->', 'r[0]', 'r[1]', '<<', ';' ],
    dmgDice: [ 'tinyObjects' ],
    adv: [ '1' ],
    tinyObjects: [ '1d4' ],
    disadv: [ '0' ],
  };
  const result = [ 72 ];
  const rolls = {
    4: [ '3(d4)', '2(d4)', '4(d4)', '4(d4)', '4(d4)', '4(d4)', '2(d4)', '3(d4)', '1(d4)', '3(d4)', '1(d4)', '1(d4)' ],
    20: [ '13(d20)', '3(d20)', '12(d20)', '4(d20)', '2(d20)', '13(d20)', '17(d20)', '17(d20)', '15(d20)', '11(d20)', '15(d20)', '3(d20)', '20(d20)', '18(d20)', '7(d20)', '20(d20)', '3(d20)', '15(d20)', '9(d20)', '7(d20)' ],
  };
  const uncertainValues = [ 'ac@Defender' ];
  const initialSideEffects = {};
  const macrosWithCertainty = value => ({
    ...allMacros,
    [ uncertainValues[ 0 ] ]: [ `${value}` ],
  });
  const resultRange = d6.formulaRoller.buildResultRange({
    expressions, allMacros, result, rolls, uncertainValues, initialSideEffects, macrosWithCertainty,
  });
  const expectedResultRange = [
    { 'maxValue': 17, 'minValue': 0, 'result': [72], 'sideEffects': {}, 'variable': 'ac@Defender' },
    { 'maxValue': 20, 'minValue': 18, 'result': [67], 'sideEffects': {} },
    { 'maxValue': 21, 'minValue': 21, 'result': [62], 'sideEffects': {} },
    { 'maxValue': 23, 'minValue': 22, 'result': [50], 'sideEffects': {} },
    { 'maxValue': 25, 'minValue': 24, 'result': [29], 'sideEffects': {} },
    { 'minValue': 26, 'result': [21], 'sideEffects': {} }
  ];
  expect(resultRange).toEqual(expectedResultRange);
});
