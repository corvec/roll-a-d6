import tokenize, { splitTokenList } from '../formulaTokenizer.js';
import { clauseHasMislocatedAssignmentOperator } from '../validateFormula.js';
import convertToRPN from '../rpnConverter.js';
import { objectMakerReduceHelper } from '../helpers.js';
import type { MacroCollection, RPNTokenList } from '../types.js';

interface ConvertedRoll {
  /** [macroName, '=', ...mainExpressionTokens] */
  main: string[];
  /** Tokenized helper clauses, each of the form [name, '=', ...tokens] */
  helpers: string[][];
}

/**
 * Transform a formula from the collection into a "main" token list and helper token lists
 */
const convertFormulaToRoll = (tokens: string[], macroName: string): ConvertedRoll | null => {
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
 *
 * @example // returns { roll: { formula: ['1d20', 'bonus', '+'], helpers: { bonus: ['10'] } } }
 * getMacrosFromCollection({ 'roll': '1d20+bonus,bonus=10'})
 *
 * @param collectionFormulasMap String formulas, basically as entered by the user
 */
const getMacrosFromCollection = (collectionFormulasMap: Record<string, string>): MacroCollection => {
  const rewrittenFormulas = Object.entries(collectionFormulasMap)
    .map(([macroName, formula]) => convertFormulaToRoll(tokenize(formula) as string[], macroName))
    .filter((roll): roll is ConvertedRoll => Boolean(roll));
  const macrosAsAnObject = rewrittenFormulas.reduce(
    (accum: MacroCollection, { main, helpers }) => ({
      ...accum,
      [main[0]]: {
        formula: convertToRPN(main.slice(2)),
        helpers: helpers
          .map((tokens): [string, RPNTokenList] => [tokens[0], convertToRPN(tokens.slice(2))])
          .reduce(objectMakerReduceHelper, {}),
      },
    }), {});
  return macrosAsAnObject;
};

export default getMacrosFromCollection;
