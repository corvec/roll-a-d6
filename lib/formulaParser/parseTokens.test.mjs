import parseTokens from './parseTokens';

it('parses a simple expression', () => {
   const result = parseTokens(['1d20']);
   expect(result).toEqual({
      expressions: [['1d20']],
      macros: {},
      unassignedVariables: [],
      noPromptVariables: [],
   });
});

it('parses a more complex expression', () => {
   const result = parseTokens(['1d20', '+', 'bonus', '>', 'ac', ',', 'bonus', '=', '10']);
   expect(result).toEqual({
      expressions: [['1d20', 'bonus', '+', 'ac', '>']],
      macros: { bonus: ['10'] },
      unassignedVariables: ['ac'],
      noPromptVariables: [],
   });
});


it('correctly detects noPromptVariables', () => {
   const result = parseTokens(['1d20', '+', 'bonus', '>', 'ac', ',', 'bonus', '=', '5', '+', '^prof']);
   expect(result).toEqual({
      expressions: [['1d20', 'bonus', '+', 'ac', '>']],
      macros: { bonus: ['5', '^prof', '+'] },
      unassignedVariables: ['ac', 'prof'],
      noPromptVariables: ['prof'],
   });
});


it('parses a complex expression with a target collection', () => {
   const result = parseTokens(['1d20', '+', 'bonus', '>', 'ac@Defender', ',', 'bonus', '=', '10']);
   expect(result).toEqual({
      expressions: [['1d20', 'bonus', '+', 'ac@Defender', '>']],
      macros: { bonus: ['10'] },
      unassignedVariables: ['ac@Defender'],
      noPromptVariables: [],
   });
});
