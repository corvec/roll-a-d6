import evaluateFormula from './evaluateFormula';

const expectEval = (...tokens) => expect(
  evaluateFormula({ expressions: [tokens.map(t => `${t}`)], macros: {} })
);

const getResult = (...values) => ({ result: values, rolls: {}, sideEffects: {} });

const eer = (tokens, value) => expectEval(...tokens).toEqual(getResult(value));

it('1 => 1', () => {
  eer([1], 1);
});

it('-1 => -1', () => {
  eer([-1], -1);
});

it('1+2 => 3', () => {
  eer([1,2,'+'], 3);
});

it('1-2 => -1', () => {
  eer([1,2,'-'], -1);
});

it('1+-2 => -1', () => {
  eer([1,-2,'+'], -1);
});

it('1--2 => 3', () => {
  eer([1,-2,'-'], 3);
});

it('2*3 => 6', () => {
  eer([2,3,'*'], 6);
});

it('8/4 => 2', () => {
  eer([8,4,'/'], 2);
});

it('9/4 => 2', () => {
  eer([9,4,'/'], 2);
});

it('5 > 4 => true', () => {
  eer([5,4,'>'], true);
});

it('5 > 6 => false', () => {
  eer([5,6,'>'], false);
});

it('5 < 4 => false', () => {
  eer([5,4,'<'], false);
});

it('5 < 6 => true', () => {
  eer([5,6,'<'], true);
});

it('<=', () => {
  eer([5,6,'<='], true);
  eer([6,6,'<='], true);
  eer([6,5,'<='], false);
});

it('>=', () => {
  eer([5,6,'>='], false);
  eer([6,6,'>='], true);
  eer([6,5,'>='], true);
});

it('5 >> 4 => 5', () => {
  eer([5,4,'>>'], 5);
});

it('5 << 6 => 5', () => {
  eer([5,6,'<<'], 5);
});

it('==', () => {
  eer([5,6,'=='], false);
  eer([6,6,'=='], true);
  eer([6,5,'=='], false);
  eer([true,5,'=='], false);
  eer([false,5,'=='], false);
  eer([false,true,'=='], false);
  eer([true,false,'=='], false);
  eer([false,false,'=='], true);
  eer([true,true,'=='], true);
});

it('<>', () => {
  eer([5,6,'<>'], true);
  eer([6,6,'<>'], false);
  eer([6,5,'<>'], true);
  eer([true,false,'<>'], true);
  eer([true,true,'<>'], false);
  eer([false,true,'<>'], true);
  eer([false,false,'<>'], false);
});

it('||', () => {
  eer([true,true,  '||'], true);
  eer([true,false, '||'], true);
  eer([false,true, '||'], true);
  eer([false,false,'||'], false);
});

it('&&', () => {
  eer([true,true,  '&&'], true);
  eer([true,false, '&&'], false);
  eer([false,true, '&&'], false);
  eer([false,false,'&&'], false);
});

it('5>4->20;30 => 20', () => {
  eer([5, 4, '>', '20', '->', 30, ';'], 20);
});

it('IF THEN ELSE does not evaluate the other path', () => {
  const rpnFormula = '1d20 21 > => 1d10 -> 0 ;'.split(' ');
  const {result, rolls } = evaluateFormula({ expressions: [rpnFormula], macros: {} });
  expect(result).toEqual([0]);
  expect(Object.keys(rolls).length).toEqual(1);
  expect(rolls[20].length).toEqual(1);
});

it('3*(6+3)', () => {
  eer([3, 6, 3, '+', '*'], 27);
});

it('3#+(6+3)', () => {
  eer([3, 6, 3, '+', '#+'], 27);
});

it('3#*(6+3)', () => {
  eer([3, 6, 3, '+', '#*'], 729);
});

it('3#&(6>3)', () => {
  eer([3, 6, 3, '>', '#&'], true);
});

it('3#|(6>3)', () => {
  eer([3, 6, 3, '>', '#|'], true);
});

it('r=5+4,3#+r', () => {
  const result = evaluateFormula({
    expressions: [['3', 'r', '#+']],
    macros: {
      r: ['5', '4', '+'],
    }
  });
  expect(result).toEqual(getResult(27));
});

it('r=5>4,4#&r', () => {
  const result = evaluateFormula({
    expressions: [['4', 'r', '#&']],
    macros: {
      r: ['5', '4', '>'],
    }
  });
  expect(result).toEqual(getResult(true));
});

it('r=5+4,3#*r', () => {
  const result = evaluateFormula({
    expressions: [['3', 'r', '#*']],
    macros: {
      r: ['5', '4', '+'],
    }
  });
  expect(result).toEqual(getResult(729));
});

it('r=5>4,4#|r', () => {
  const result = evaluateFormula({
    expressions: [['4', 'r', '#|']],
    macros: {
      r: ['5', '4', '>'],
    }
  });
  expect(result).toEqual(getResult(true));
});

it('simple reevaluation returns the same value', () => {
  const expressions = [['1d100']];
  const macros = {};
  const { result, rolls } = evaluateFormula({ expressions, macros });
  const { result: secondResult } = evaluateFormula({ expressions, macros, rolls });
  expect(result).toEqual(secondResult);
});

it('reevaluation with macros returns the same value', () => {
  const expressions = [['foo']];
  const macros = { foo: ['1d100', '1d1000', '+']};
  const { result, rolls } = evaluateFormula({ expressions, macros });
  const { result: secondResult } = evaluateFormula({ expressions, macros, rolls });
  expect(result).toEqual(secondResult);
});

it('reevaluation with macro expansion (1d6#+foo, foo=1d1000) returns the same value', () => {
  const expressions = [['1d6', 'foo', '#+']];
  const macros = { foo: ['1d1000'] };
  const { result, rolls } = evaluateFormula({ expressions, macros });
  const { result: secondResult } = evaluateFormula({ expressions, macros, rolls });
  expect(result).toEqual(secondResult);
});

it('evaluates the Animated Objects test that was failing in 0.2.1', () => {
  const expressions = [[ 'atk', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+', 'atk', '+' ]];
  const macros = {
    dmgMod: [ '4' ],
    prof: [ '4' ],
    r: [ '1d20' ],
    // The fix was in the atk formula:
    atk: ['roll[0]','20','==','=>','dmgDice[0]','dmgDice[1]','+','dmgMod','+','->','roll[0]','1','==','=>','0','->','roll[0]','bonus','+','ac@Defender','>=','=>','dmgDice[0]','dmgMod','+','->','0',';',';',';'],
    bonus: [ 'prof', 'dmgMod', '+' ],
    'ac@Defender': [ '100' ],
    roll: ['^adv', '^disadv', '&&', 'adv', '0', '==', 'disadv', '0', '==', '&&', '||', '=>', 'r[0]', '->', 'adv', '=>', 'r[0]', 'r[1]', '>>', '->', 'r[0]', 'r[1]', '<<', ';', ';'],
    dmgDice: [ 'tinyObjects' ],
    adv: [ '1' ],
    tinyObjects: [ '1d4' ],
    disadv: [ '1' ],
  };
  const rolls = {
    4: ['4(d4)', '3(d4)', '4(d4)', '3(d4)'],
    20: ['6(d20)', '6(d20)', '10(d20)', '6(d20)', '2(d20)', '1(d20)', '1(d20)', '20(d20)', '11(d20)', '10(d20)'],
  };
  const rollsCopy = {
    4: [...rolls[4]],
    20: [...rolls[20]],
  };
  const { result, rolls: newRolls } = evaluateFormula({ expressions, rolls, macros });
  console.log(newRolls);

  expect(result).toEqual([11]);
  expect(newRolls).toEqual(rollsCopy);
});

