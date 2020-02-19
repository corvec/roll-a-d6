import validateFormula, { validateParentheses } from './validateFormula';

it('validates parentheses', () => {
  expect(validateParentheses('()()()()')).toEqual(true);
  expect(validateParentheses('(()()())')).toEqual(true);
  expect(validateParentheses(')()()()(')).toEqual(false);
  expect(validateParentheses('(()()()')).toEqual(false);
  expect(validateParentheses('()()())')).toEqual(false);
});

it('validates some simple expressions', () => {
  expect(validateFormula('1')).toEqual([]);
  expect(validateFormula('Dex+10')).toEqual([]);
  expect(validateFormula('1d6')).toEqual([]);
  expect(validateFormula('1d6+10')).toEqual([]);
});

it('validates a negative number', () => {
  expect(validateFormula('-1')).toEqual([]);
});

it('validates brackets', () => {
  expect(validateFormula('Dex[1]')).toEqual([]);
});

it('validates a user expression', () => {
  expect(validateFormula('dmgDice=longSword,atk+atk,ac=15')).toEqual([]);
});

it('validates roll', () => {
  const roll = 'r=1d20,^adv==^disadv->r[0];(adv->(r[0]>r[1]->r[0];r[1]);(disadv->(r[0]>r[1]->r[1];r[0]);r[0]))';
  expect(validateFormula(roll)).toEqual([]);
});

it('validates atk', () => {
  const atk = 'roll[0]==20->dmgDice[0]+dmgDice[1]+dmgMod;(roll[0]==1->0;roll[0]+bonus>ac@Defender->dmgDice[0]+dmgMod;0)';
  expect(validateFormula(atk)).toEqual([]);
});

it('marks some invalid expressions appropriately', () => {
  expect(validateFormula('')).toContainEqual(expect.any(String));
  expect(validateFormula('1,')).toContainEqual(expect.any(String));
  expect(validateFormula('1 1')).toContainEqual(expect.any(String));
  expect(validateFormula('1+')).toContainEqual(expect.any(String));
  expect(validateFormula('+1')).toContainEqual(expect.any(String));
  expect(validateFormula('/1')).toContainEqual(expect.any(String));
  expect(validateFormula('*1')).toContainEqual(expect.any(String));
  expect(validateFormula('*1')).toContainEqual(expect.any(String));
  expect(validateFormula('[]')).toContainEqual(expect.any(String));
  expect(validateFormula('Dex[a]')).toContainEqual(expect.any(String));
  expect(validateFormula('Dex]1[')).toContainEqual(expect.any(String));
  expect(validateFormula('Dex[1+1]')).toContainEqual(expect.any(String));
  expect(validateFormula('Dex[]')).toContainEqual(expect.any(String));
});

it('marks an instance operator without a preceding variable name as invalid', () => {
  expect(validateFormula('[1]')).toContainEqual(expect.any(String));
  expect(validateFormula('15[1]')).toContainEqual(expect.any(String));
});

it('marks formulas using expansion (#) operators as valid', () => {
  expect(validateFormula('10#+1d6')).toEqual([]);
  expect(validateFormula('10#*1d6')).toEqual([]);
  expect(validateFormula('10#&(1d6>1)')).toEqual([]);
  expect(validateFormula('5#|(1d6>6)')).toEqual([]);
});
