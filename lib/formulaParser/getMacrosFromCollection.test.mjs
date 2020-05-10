import getMacrosFromCollection from './getMacrosFromCollection';

it('converts a simple collection set', () => {
  const result = getMacrosFromCollection({ 'roll': '1d20+bonus,bonus=10'});
  expect(result).toEqual({
     roll: {
       formula: ['1d20', 'bonus', '+'],
       helpers: {
         bonus: ['10']
       },
     },
  });
});
