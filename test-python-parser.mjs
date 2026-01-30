import { parse } from 'python-ast';
import { readFileSync } from 'fs';

const code = readFileSync('messy-project/src/utils/data_processor.py', 'utf-8');
const ast = parse(code);

console.log('Root type:', ast.type);
console.log('Root keys:', Object.keys(ast).join(', '));
if (ast.body) {
  console.log('Body length:', ast.body.length);
  console.log('First 3 body items:');
  ast.body.slice(0, 3).forEach((item, i) => {
    console.log(`  ${i}: type=${item.type}, name=${item.name || 'N/A'}`);
  });
}
