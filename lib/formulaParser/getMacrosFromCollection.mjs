import tokenize, { splitTokenList } from '../formulaTokenizer';
import { clauseHasMislocatedAssignmentOperator } from '../validateFormula';
import convertToRPN from '../rpnConverter';
import { objectMakerReduceHelper } from '../helpers';


/**
 * Transform a formula from the collection into a "main" token list and helper token lists
 * @function convertFormulaToRoll
 *
 * @param {RPNTokenList} tokens
 * @param {string} macroName
 *
 * @returns {CollectionRoll|null}
 */
const convertFormulaToRoll = (tokens, macroName) => {
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
 * Convert formulas from the collection(s) into a usable object, already converted to RPN.
 * NOTE: In order to be usable in this way, the collection formula must have exactly 1 "main" expression.
 *       Formulas with 0 or 2+ main expressions are filtered out.
 * @function getMacrosFromCollection
 *
 * @example // returns { roll: { formula: ['1d20', 'bonus', '+'], helpers: { bonus: ['10'] } } }
 * getMacrosFromCollection({ 'roll': '1d20+bonus,bonus=10'})
 *
 * @param {object.<string, string>} collectionFormulasMap - String formulas, basically as entered by the user
 *
 * @returns {Collection}
 */
const getMacrosFromCollection = (collectionFormulasMap) => {
  const rewrittenFormulas = Object.entries(collectionFormulasMap)
    .map(([macroName, formula]) => convertFormulaToRoll(tokenize(formula), macroName))
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
