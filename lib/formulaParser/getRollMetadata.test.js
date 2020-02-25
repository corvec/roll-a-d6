import getRollMetadata from './getRollMetadata';

const emptyResult = {
  internalMacros: {},
  externalMacros: {},
  unknownVariables: [],
  noPromptVariables: [],
  sideEffects: [],
  targetedCollections: {},
};

it('evaluates a simple roll', () => {
  const result = getRollMetadata('1d20', {});
  expect(result).toEqual({
    ...emptyResult,
    type: 'roll',
  });
});

it('evaluates a simple value', () => {
  const result = getRollMetadata('1+20', {});
  expect(result).toEqual({
    ...emptyResult,
    value: [21],
    type: 'value',
  });
});

const getCM = (...formula) => ({ formula: formula.map(_ =>`${_}`), helpers: {} });

it('evaluates a simple value', () => {
  const result = getRollMetadata('1+20', {});
  expect(result).toEqual({
    ...emptyResult,
    value: [21],
    type: 'value',
  });
});

it('evaluates a simple roll with a side effect', () => {
  const result = getRollMetadata('1d20>10->$a+=1;0');
  expect(result.sideEffects).toEqual(['a']);
});

it('evaluates a roll with some dependencies', () => {
  const result = getRollMetadata('1d20+bonus,bonus=Dex+prof',
    {
      Dex: getCM(5),
      prof: { formula: ['2', 'foo', '+'], helpers: { foo: ['2'] } }
    });
  expect(result).toEqual({
    ...emptyResult,
    internalMacros: { bonus: ['Dex', 'prof', '+']},
    externalMacros: {
      Dex: ['5'],
      prof: ['2', 'foo', '+'],
      foo: ['2'],
    },
    type: 'roll',
  });
});

it('evaluates a value with some unknown dependencies', () => {
  const result = getRollMetadata('bonus>hp', {
    bonus: getCM('prof', '+', 'Dex', '+', '^extra'),
    Dex: getCM(5),
    prof: getCM(4),
  });
  expect(result).toEqual({
    ...emptyResult,
    externalMacros: {
      bonus: ['prof', '+', 'Dex', '+', '^extra'],
      Dex: ['5'],
      prof: ['4'],
    },
    unknownVariables: ['hp', 'extra'],
    noPromptVariables: ['extra'],
    type: 'value-with-unknowns',
  });
});


it('categorizes a dice roll with unknowns', () => {
  const result = getRollMetadata('dmgDice+bonus', {
    dmgDice: getCM('longSword'),
    longSword: getCM('^oneHanded', '->', '1d8', ';', '1d10'),
    longBow: getCM('1d8'),
    bonus: getCM('Str','+','prof'),
    Dex: getCM(5),
    Str: getCM(3),
    prof: getCM(4),
  });
  expect(result).toEqual({
    ...emptyResult,
    externalMacros: {
      bonus: ['Str', '+', 'prof'],
      prof: ['4'],
      Str: ['3'],
      dmgDice: ['longSword'],
      longSword: ['^oneHanded', '->', '1d8', ';', '1d10'],
    },
    unknownVariables: ['oneHanded'],
    noPromptVariables: ['oneHanded'],
    type: 'roll-with-unknowns',
  });
});

it('deals with target collections appropriately', () => {
  const result = getRollMetadata('roll+bonus>ac@Defender', {
    roll: getCM('1d20'),
    bonus: getCM(10),
    ac: getCM(18)
  });
  expect(result).toEqual({
    ...emptyResult,
    externalMacros: {
      bonus: ['10'],
      roll: ['1d20'],
    },
    unknownVariables: ['ac@Defender'],
    targetedCollections: {
      Defender: ['ac'],
    },
    type: 'roll-with-unknowns',
  });
});


it('deals with target collections appropriately, even in helpers of Collection macros', () => {
  const result = getRollMetadata('atk,dmgDice=1d8', {
    atk: {
      formula: ['hit','->','dmg','0'],
      helpers: {
        hit: ['roll', '+', 'bonus', '>', 'ac@Defender'],
        dmg: ['dmgDice', '+', 'bonus'],
      },
    },
    roll: getCM('1d20'),
    bonus: getCM(10),
    ac: getCM(18)
  });
  expect(result).toEqual({
    ...emptyResult,
    internalMacros: {
      dmgDice: ['1d8'],
    },
    externalMacros: {
      atk: ['hit','->','dmg','0'],
      hit: ['roll', '+', 'bonus', '>', 'ac@Defender'],
      dmg: ['dmgDice', '+', 'bonus'],
      bonus: ['10'],
      roll: ['1d20'],
    },
    unknownVariables: ['ac@Defender'],
    targetedCollections: {
      Defender: ['ac'],
    },
    type: 'roll-with-unknowns',
  });
});


