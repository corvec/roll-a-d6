import evaluateFormula from './evaluateFormula';

const expectEval = (...tokens) => expect(
  evaluateFormula({ expressions: [tokens.map(t => `${t}`)], macros: {} })
);

const getResult = (...values) => ({ result: values, rolls: [], sideEffects: {} });

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
  const roll = evaluateFormula({ expressions: [rpnFormula], macros: {} });
  expect(roll.result).toEqual([0]);
  expect(roll.rolls.length).toEqual(1);
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


