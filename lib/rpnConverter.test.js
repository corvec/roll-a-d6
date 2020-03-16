import convertToRPN from './rpnConverter';
import {tokenize} from "./formulaTokenizer";
import {rpnConverter} from "./index";

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
  expectWrapper(tokens, '1d20 10 + ac >= => 1d6 10 + -> 0 ;');
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
    '1d20 10 > => 1d6 8 + -> 0 ;'
  );
});

it('operator order examples are in the correct order', () => {
    const examples = [
        [ '5+(6*7)', '5+6*7'],
        [ '(5+6)>(7*8)', '5+6>7*8'],
        [ '((10+1d4)>>1d20)#+(6+1d6)', '10+1d4>>1d20#+6+1d6'],
        [ '(((10+1d4)>>1d20)#+(6+1d6)<20)->1d8;0', '10+1d4>>1d20#+6+1d6->1d8;0']
    ];
    examples.forEach(([parenExample, oooExample]) => {
       const parenTokens = tokenize(parenExample);
       const oooTokens = tokenize(parenExample);
       const parenResult = rpnConverter(parenTokens);
       const oooResult = rpnConverter(oooTokens);
       expect(parenResult).toEqual(oooResult);
    });

});

it('converts the "roll" helper correctly', () => {
  const input = '(^adv&&^disadv)||(adv==0&&disadv==0)->r[0];(adv->r[0]>>r[1];r[0]<<r[1])';
  const tokenizedInput = tokenize(input);
  const result = rpnConverter(tokenizedInput);
  const expected = ["^adv", "^disadv", "&&", "adv", "0", "==", "disadv", "0", "==", "&&", "||", "=>", "r[0]", "->", "adv", "=>", ";", "r[0]", "r[1]", ">>", "->", "r[0]", "r[1]", "<<", ";"];
  expect(result).toEqual(expected);
});
