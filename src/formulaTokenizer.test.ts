import tokenize, {
  getTargetCollection,
  isRoll,
  isVariable,
  isVariableInstance,
  splitTokenList,
  stripPrefix,
  stripSuffix,
} from './formulaTokenizer.js';

it('tokenizes a fairly complex statement', () => {
  const result = tokenize('2*(1d20+8>ac||1d20==20->1d6+10)');
  expect(result).toEqual([
    '2', '*', '(', '1d20', '+', '8', '>', 'ac', '||', '1d20', '==', '20', '->', '1d6', '+', '10', ')',
  ]);
});

it('tokenizes expansion (#) operators', () => {
  expect(tokenize('10#+1d6')).toEqual(['10', '#+', '1d6']);
  expect(tokenize('10#*1d6')).toEqual(['10', '#*', '1d6']);
  expect(tokenize('10#&1d6')).toEqual(['10', '#&', '1d6']);
  expect(tokenize('10#|1d6')).toEqual(['10', '#|', '1d6']);
});

it('splitTokens splits on a comma', () => {
  const tokens = Array.from('2+3,4+5');
  const result = splitTokenList(tokens);
  expect(result).toEqual([Array.from('2+3'), Array.from('4+5')]);
});

it('tokenizes negative numbers', () => {
  const result = tokenize('-5');
  expect(result).toEqual(['-5']);
});

it('tokenizes subtraction', () => {
  const result = tokenize('8-4');
  expect(result).toEqual(['8', '-', '4']);
});

it('tokenizes subtraction of negative numbers', () => {
  const result = tokenize('8--4');
  expect(result).toEqual(['8', '-', '-4']);
});

it('tokenizes ac@defender', () => {
  const result = tokenize('1d20+5>=ac@defender');
  expect(result).toEqual(['1d20', '+', '5', '>=', 'ac@defender']);
});

it('tokenizes assignment', () => {
  expect(tokenize('5:=$a')).toEqual(['5', ':=', '$a']);
  expect(tokenize('5+=$a')).toEqual(['5', '+=', '$a']);
  expect(tokenize('5-=$a')).toEqual(['5', '-=', '$a']);
});

it('tokenizes formulas with forced separators properly', () => {
  expect(tokenize('5:=$a...a+b')).toEqual(['5', ':=', '$a', '...', 'a', '+', 'b']);
});

it('a is a variable and not a variable instance, but a[0]', () => {
  expect(isVariable('a')).toEqual(true);
  expect(isVariable('a[0]')).toEqual(false);
  expect(isVariableInstance('a')).toEqual(false);
  expect(isVariableInstance('a[0]')).toEqual(true);
});

it('^a is a variable (^a[1] is nothing)', () => {
  expect(isVariable('^a')).toEqual(true);
  expect(isVariable('^a[0]')).toEqual(false);
  expect(isVariableInstance('^a')).toEqual(false);
  expect(isVariableInstance('^a[0]')).toEqual(false);
});

it('a@B is a variable (a[1]@B is a variable instance)', () => {
  expect(isVariable('a@B')).toEqual(true);
  expect(isVariable('a[0]@B')).toEqual(false);
  expect(isVariableInstance('a@B')).toEqual(false);
  expect(isVariableInstance('a[0]@B')).toEqual(true);
});

it('stripPrefix strips ^', () => {
  expect(stripPrefix('^a')).toEqual('a');
  expect(stripPrefix('a')).toEqual('a');
  expect(stripPrefix('^a[1]')).toEqual('a[1]');
  expect(stripPrefix('a[1]')).toEqual('a[1]');
});

it('stripPrefix strips $', () => {
  expect(stripPrefix('$a')).toEqual('a');
  expect(stripPrefix('a')).toEqual('a');
  expect(stripPrefix('$a[1]')).toEqual('a[1]');
  expect(stripPrefix('a[1]')).toEqual('a[1]');
});

it('stripSuffix strips [1]', () => {
  expect(stripSuffix('^a[1]')).toEqual('^a');
  expect(stripSuffix('a[1]')).toEqual('a');
  expect(stripSuffix('^a')).toEqual('^a');
  expect(stripSuffix('a')).toEqual('a');
});

it('stripSuffix strips @Defender', () => {
  expect(stripSuffix('^a[1]')).toEqual('^a');
  expect(stripSuffix('a[1]')).toEqual('a');
  expect(stripSuffix('^a')).toEqual('^a');
  expect(stripSuffix('a')).toEqual('a');
});

it('stripSuffix strips [1]@Defender', () => {
  expect(stripSuffix('^a@Defender')).toEqual('^a');
  expect(stripSuffix('a@Defender')).toEqual('a');
  expect(stripSuffix('^a')).toEqual('^a');
  expect(stripSuffix('a')).toEqual('a');
});

it('stripPrefix(stripSuffix strips ^, $ and [1]@Defender', () => {
  expect(stripPrefix(stripSuffix('^a[1]@Defender'))).toEqual('a');
  expect(stripPrefix(stripSuffix('$a[1]@Defender'))).toEqual('a');
  expect(stripPrefix(stripSuffix('a[1]@Defender'))).toEqual('a');
  expect(stripPrefix(stripSuffix('^a@Defender'))).toEqual('a');
  expect(stripPrefix(stripSuffix('$a@Defender'))).toEqual('a');
  expect(stripPrefix(stripSuffix('a@Defender'))).toEqual('a');
  expect(stripPrefix(stripSuffix('a'))).toEqual('a');
});

it('stripSuffix strips lowercase collection targets', () => {
  expect(stripSuffix('a@defender')).toEqual('a');
  expect(stripSuffix('a[1]@defender')).toEqual('a');
  expect(stripPrefix(stripSuffix('$a@defender'))).toEqual('a');
});

it('isRoll matches only complete roll tokens', () => {
  expect(isRoll('3d6')).toBe(true);
  expect(isRoll('10d20')).toBe(true);
  expect(isRoll('1d1000')).toBe(true);
  expect(isRoll('d6')).toBe(false);
  expect(isRoll('2d6x')).toBe(false);
  expect(isRoll('x2d6')).toBe(false);
  expect(isRoll('3d')).toBe(false);
});

it('getTargetCollection(ac@Defender) returns Defender', () => {
  expect(getTargetCollection('ac@Defender')).toEqual('Defender');
  expect(getTargetCollection('ac[0]@Defender')).toEqual('Defender');
  expect(getTargetCollection('ac')).toEqual(null);
});
