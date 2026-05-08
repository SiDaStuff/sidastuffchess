const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadChess() {
  const chessModule = require('chess.js');
  return chessModule.Chess || chessModule;
}

function loadAnalyzer() {
  const Chess = loadChess();
  const analysisPath = path.resolve(__dirname, '../../../public/js/analysis.js');
  const source = fs.readFileSync(analysisPath, 'utf8');
  const sandbox = {
    Chess,
    console,
    module: { exports: {} },
    exports: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nmodule.exports = { MoveAnalyzer, MoveClassification };`, sandbox, {
    filename: 'analysis.js',
  });
  return sandbox.module.exports;
}

module.exports = { loadAnalyzer, loadChess };
