import getUnassignedVariablesAndUsedMacros from './getUnassignedVariablesAndUsedMacros';

it('extracts data from "1d20"', () => {
  const result = getUnassignedVariablesAndUsedMacros([['1d20']], []);
  expect(result).toEqual({
    variables: [],
    usedMacros: {},
  });
});

it('extracts data from "1d20+bonus>ac,bonus=10"', () => {
  const result = getUnassignedVariablesAndUsedMacros(
    [['1d20', '+', 'bonus', '>', 'ac']],
    {
      bonus: [ '10' ],
    });
  expect(result).toEqual({
    variables: ['ac'],
    usedMacros: { bonus: [ '10' ] },
  });
});


it('extracts data from "1d20+bonus>ac@Defender,bonus=10"', () => {
  const result = getUnassignedVariablesAndUsedMacros(
    [['1d20', '+', 'bonus', '>', 'ac@Defender']],
    {
      bonus: [ '10' ],
    });
  expect(result).toEqual({
    variables: ['ac@Defender'],
    usedMacros: { bonus: [ '10' ] },
  });
});


it('recursively extracts data from "1d20+bonus>ac,bonus=5+^prof"', () => {
  const result = getUnassignedVariablesAndUsedMacros(
    [['1d20', '+', 'bonus', '>', 'ac']],
    {
      bonus: [ '5', '+', '^prof' ],
    }
  );
  expect(result).toEqual({
    variables: ['ac', 'prof'],
    usedMacros: {
      bonus: [ '5', '+', '^prof' ],
    },
  });
});

it('extracts data when pulling from collections', () => {
  const result = getUnassignedVariablesAndUsedMacros(
    [['dmgDice', '+', 'bonus']],
    {
      bonus: [ '5', '+', '^prof' ],
    },
    {
      prof: { formula: ['4'], helpers: {}},
      dmgDice: { formula: ['longSword'], helpers: {}},
      longSword: { formula: ['oneHanded', '->', '1d8', ';', '1d10'], helpers: {}},
      longBow: { formula: ['1d8'], helpers: {}}
    }
  );
  expect(result).toEqual({
    variables: ['oneHanded'],
    usedMacros: {
      bonus: [ '5', '+', '^prof' ],
      prof: ['4'],
      dmgDice: ['longSword'],
      longSword: ['oneHanded', '->', '1d8', ';', '1d10'],
    },
  });

});

it('extracts data when pulling from collections without overwriting internal macros', () => {
  const result = getUnassignedVariablesAndUsedMacros(
    [['dmgDice', '+', 'bonus']],
    {
      bonus: [ '5', '+', '^prof' ],
      dmgDice: ['longBow']
    },
    {
      prof: { formula: ['4'], helpers: {}},
      dmgDice: { formula: ['longSword'], helpers: {}},
      longSword: { formula: ['oneHanded', '->', '1d8', ';', '1d10'], helpers: {}},
      longBow: { formula: ['1d8'], helpers: {}}
    }
  );
  expect(result).toEqual({
    variables: [],
    usedMacros: {
      bonus: [ '5', '+', '^prof' ],
      prof: ['4'],
      dmgDice: ['longBow'],
      longBow: ['1d8'],
    },
  });
});

it('extracts data when pulling from helpers only when the main macro is relevant', () => {
  const result = getUnassignedVariablesAndUsedMacros(
    [['dmgDice', '+', 'bonus']],
    {},
    {
      bonus: { formula: ['prof', '+', 'Dex'], helpers: { prof: ['4']} },
      dontInclude: { formula: ['Dex'], helpers: { Dex: ['5'] }},
      dmgDice: { formula: ['1d8'], helpers: {}},
    }
  );
  expect(result).toEqual({
    variables: ['Dex'],
    usedMacros: {
      bonus: ['prof', '+', 'Dex'],
      prof: ['4'],
      dmgDice: ['1d8'],
    },
  });
});

