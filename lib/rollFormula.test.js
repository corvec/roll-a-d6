import * as d6 from './index';


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
  const formula = '1d20+bonus>21->1d10+1d8+1d6;0';
  expect(d6.rollFormula(formula, { bonus: '0'}).rolls.length).toBe(1);
  expect(d6.rollFormula(formula, { bonus: '20'}).rolls.length).toBe(4);
});

it('handles internal-only side effects', () => {
  const formula = 'a=1,decA=a>0->$a-=1...10;0,decA+decA';
  const roll = d6.rollFormula(formula, {});
  expect(roll.result[0]).toBe(10);
});
