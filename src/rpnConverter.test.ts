import convertToRPN from './rpnConverter.js';
import { tokenize } from './formulaTokenizer.js';
import { rpnConverter } from './index.js';

const expectWrapper = (input: string | string[], output: string) => {
  const tokens = Array.isArray(input) ? input : Array.from(input);
  const result = convertToRPN(tokens);
  expect(result.join(' ')).toEqual(output);
};

it('convertRPN converts 2+3+4', () => {
  expectWrapper('2+3+4', '2 3 + 4 +');
});

it('convertRPN converts 2+3*4', () => {
  expectWrapper('2+3*4', '2 3 4 * +');
});

it('convertRPN converts 2+3*4*5', () => {
  expectWrapper('2+3*4*5', '2 3 4 * 5 * +');
});

it('convertRPN converts (2+3)*4*5', () => {
  expectWrapper('(2+3)*4*5', '2 3 + 4 * 5 *');
});

it('convertRPN converts 1d20+10>=ac->1d6+10;0', () => {
  const tokens = ['1d20', '+', '10', '>=', 'ac', '->', '1d6', '+', '10', ';', '0'];
  expectWrapper(tokens, '1d20 10 + ac >= => 1d6 10 + -> 0 ;');
});

it('convertRPN handles || and &&', () => {
  expectWrapper(
    ['2', '<', '3', '||', '3', '>', '4', '&&', '5', '<', '6'],
    '2 3 < 3 4 > || 5 6 < &&',
  );
});

it('convertRPN handles then and else', () => {
  expectWrapper(
    ['1d20', '>', '10', '->', '1d6', '+', '8', ';', '0'],
    '1d20 10 > => 1d6 8 + -> 0 ;',
  );
});

it('operator order examples are in the correct order', () => {
  const examples = [
    ['5+(6*7)', '5+6*7'],
    ['(5+6)>(7*8)', '5+6>7*8'],
    ['((10+1d4)>>1d20)#+(6+1d6)', '10+1d4>>1d20#+6+1d6'],
    ['(((10+1d4)>>1d20)#+(6+1d6)<20)->1d8;0', '10+1d4>>1d20#+6+1d6->1d8;0'],
  ];
  examples.forEach(([parenExample]) => {
    const parenTokens = tokenize(parenExample) as string[];
    const oooTokens = tokenize(parenExample) as string[];
    const parenResult = rpnConverter(parenTokens);
    const oooResult = rpnConverter(oooTokens);
    expect(parenResult).toEqual(oooResult);
  });
});

it('convertRPN chains else-if conditionals without parentheses', () => {
  expectWrapper(
    ['a', '->', 'b', ';', 'c', '->', 'd', ';', 'e'],
    'a => b -> c => d -> e ; ;',
  );
});

it('unparenthesized else-if chains convert identically to parenthesized ones', () => {
  const chained = tokenize('a>5->b;c>5->d;e') as string[];
  const parenthesized = tokenize('a>5->b;(c>5->d;e)') as string[];
  expect(convertToRPN(chained)).toEqual(convertToRPN(parenthesized));
});

it('convertRPN completes a then-branch with pending operators before the else', () => {
  expectWrapper(
    ['a', '->', 'b', '+', '1', '*', '2', ';', 'c'],
    'a => b 1 2 * + -> c ;',
  );
});

describe('function calls', () => {
  it('converts max(1,2) into arguments followed by a counted call token', () => {
    expectWrapper(['max', '(', '1', ',', '2', ')'], '1 2 max:2');
  });

  it('converts expressions inside arguments', () => {
    expectWrapper(['max', '(', '1d6', '+', '2', ',', '3', ')'], '1d6 2 + 3 max:2');
  });

  it('converts nested calls', () => {
    expectWrapper(
      ['max', '(', 'min', '(', '1d4', ',', '3', ')', ',', '5', ')'],
      '1d4 3 min:2 5 max:2',
    );
  });

  it('counts each die of a spread argument', () => {
    expectWrapper(['max', '(', '...', '3d6', ',', '5', ')'], '...3d6 5 max:4');
    expectWrapper(['min', '(', '...', '2d20', ')'], '...2d20 min:2');
  });

  it('rejects commas outside function calls', () => {
    expect(() => convertToRPN(['(', '1', ',', '2', ')'])).toThrow(/Commas are only allowed/);
  });

  it('rejects spread outside direct function arguments', () => {
    expect(() => convertToRPN(['max', '(', '(', '...', '3d6', ')', '+', '1', ',', '5', ')'])).toThrow(/Spread/);
    expect(() => convertToRPN(['max', '(', '...', 'foo', ',', '5', ')'])).toThrow(/Spread/);
  });

  it('still treats ... between values as the side-effect separator', () => {
    expectWrapper(['$a', ':=', '0', '...', '1d6'], '$a 0 := 1d6 ...');
  });
});
