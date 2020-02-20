import convertToRPN from './rpnConverter';

const expectWrapper = (input, output) => {
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
  const tokens = ['1d20','+','10','>=','ac','->','1d6','+','10',';','0'];
  // TODO: Update to account for new IF (=>) THEN (->) ELSE (;) structure
  expectWrapper(tokens, '1d20 10 + ac >= 1d6 10 + -> 0 ;');
  // expectWrapper(tokens, '1d20 10 + ac >= => 1d6 10 + -> 0 ;');
});

it('convertRPN handles || and &&', () => {
  expectWrapper(
  ['2', '<', '3', '||', '3', '>', '4', '&&', '5', '<', '6'],
  '2 3 < 3 4 > || 5 6 < &&'
  );
});

it('convertRPN handles then and else', () => {
  expectWrapper(
  ['1d20', '>', '10', '->', '1d6', '+', '8', ';', '0'],
  // TODO: Update to account for new IF (=>) THEN (->) ELSE (;) structure
    '1d20 10 > 1d6 8 + -> 0 ;'
    // '1d20 10 > => 1d6 8 + -> 0 ;'
  );
});

