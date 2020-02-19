import tokenize, { splitTokenList } from '../formulaTokenizer';
import { clauseHasMislocatedAssignmentOperator } from '../validateFormula';
import convertToRPN from '../rpnConverter';
import { objectMakerReduceHelper } from '../helpers';


/**
 * Transform a formula from the collection into a "main" token list and helper token lists
 *
 * @param tokens
 * @param macroName
 *
 * @returns {Object}|null
 * @property {tokenList} main
 * @property {tokenList[]} helpers
 */
const rewriteCollectionFormula = (tokens, macroName) => {
  const formulaClauses = splitTokenList(tokens);
  if (formulaClauses.some(clauseHasMislocatedAssignmentOperator)) {
    return null;
  }
  const expressions = formulaClauses.filter(clause => clause.length < 2 || clause[1] !== '=');
  if (expressions.length !== 1) {
    return null;
  }
  const macros = formulaClauses.filter(clause => clause.length > 2 && clause[1] === '=');
  return {
    main: [macroName, '=', ...expressions[0]],
    helpers: macros,
  };
};

/**
 * Convert macros sourced from the collection(s) into a usable format
 *
 * @example
 * // returns { roll: { formula: ['1d20', 'bonus', '+'], helpers: { bonus: ['10'] } } }
 * getMacrosFromCollection({ 'roll': '1d20+bonus,bonus=10'})
 *
 * @param {Object.<string, string>} collectionMacros
 *
 * @returns {collectionMacrosMap}
 */
const getMacrosFromCollection = (collectionMacros) => {
  const rewrittenFormulas = Object.entries(collectionMacros)
    .map(([macroName, formula]) => rewriteCollectionFormula(tokenize(formula), macroName))
    .filter(_ => _);
  const macrosAsAnObject = rewrittenFormulas.reduce(
    (accum, { main, helpers }) => ({
      ...accum,
      [main[0]]: {
        formula: convertToRPN(main.slice(2)),
        helpers: helpers
          .map(tokens => [tokens[0], convertToRPN(tokens.slice(2))])
          .reduce(objectMakerReduceHelper, {}),
      }
    }), {});
  return macrosAsAnObject;
};

export default getMacrosFromCollection;
